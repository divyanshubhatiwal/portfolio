"""The evidence graph.

Entities are nodes; every edge is justified by exactly one event, and carries
that event's id. This is the property that makes the graph forensically usable:
any path the system walks can be rendered back as a list of citations.

networkx rather than a graph database -- at case sizes in the 10^4-10^6 event
range this fits in memory comfortably, and it keeps the project deployable
without standing up a server.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Iterable, Optional

import networkx as nx

from .entities import entity_id, extract
from .schema import Entity, EntityType, Event

#: (relation, subject field, object field) derived from each event type.
_RELATIONS = {
    "login_success": [("authenticated_to", "user", "host"), ("logged_in_from", "user", "src_ip")],
    "login_failure": [("failed_auth_to", "user", "host"), ("failed_auth_from", "user", "src_ip")],
    "logout": [("logged_out_of", "user", "host")],
    "priv_escalation": [("elevated_on", "user", "host"), ("started", "user", "process")],
    "process_start": [("started", "user", "process"), ("ran_on", "process", "host")],
    "process_end": [("stopped", "user", "process")],
    "file_read": [("accessed", "process", "path"), ("accessed", "user", "path")],
    "file_write": [("modified", "process", "path"), ("modified", "user", "path")],
    "file_create": [("created", "process", "path"), ("created", "user", "path")],
    "file_delete": [("deleted", "process", "path"), ("deleted", "user", "path")],
    "archive_create": [("archived_into", "process", "path"), ("archived_into", "user", "path")],
    "net_connect": [("connected_to", "host", "dst_ip"), ("connected_to", "user", "dst_ip")],
    "net_transfer": [("transferred_to", "host", "dst_ip"), ("transferred_to", "user", "dst_ip")],
    "dns_query": [("resolved", "host", "domain")],
    "browser_visit": [("visited", "user", "domain")],
    "browser_download": [("downloaded", "user", "path"), ("downloaded_from", "user", "domain")],
}

_FIELD_TYPES = {
    "user": EntityType.USER,
    "host": EntityType.HOST,
    "process": EntityType.PROCESS,
    "path": EntityType.FILE,
    "src_ip": EntityType.IP,
    "dst_ip": EntityType.IP,
    "domain": EntityType.DOMAIN,
}


def _is_chronological(hops: list[dict]) -> bool:
    times = [hop["timestamp"] for hop in hops]
    return all(a <= b for a, b in zip(times, times[1:]))


class EvidenceGraph:
    def __init__(self, events: Iterable[Event]):
        self.events: dict[str, Event] = {ev.event_id: ev for ev in events}
        self.entities: dict[str, Entity] = extract(self.events.values())
        self.g = nx.MultiDiGraph()
        self._collapsed_cache: nx.Graph | None = None
        self._build()

    def _build(self) -> None:
        for eid, entity in self.entities.items():
            self.g.add_node(
                eid,
                entity_type=entity.entity_type.value,
                value=entity.value,
                first_seen=entity.first_seen,
                last_seen=entity.last_seen,
                event_count=len(entity.event_ids),
            )

        for ev in self.events.values():
            for relation, subject_field, object_field in _RELATIONS.get(
                ev.event_type.value, []
            ):
                subject = getattr(ev, subject_field, None)
                obj = getattr(ev, object_field, None)
                if not subject or not obj:
                    continue
                if subject_field == "path" or object_field == "path":
                    if ev.source_kind.value == "process":
                        continue  # image path, not a file of interest
                src = entity_id(_FIELD_TYPES[subject_field], str(subject))
                dst = entity_id(_FIELD_TYPES[object_field], str(obj))
                if src not in self.g or dst not in self.g:
                    continue
                self.g.add_edge(
                    src, dst,
                    key=f"{relation}:{ev.event_id}",
                    relation=relation,
                    event_id=ev.event_id,
                    timestamp=ev.timestamp,
                )

    # ---- queries -------------------------------------------------------

    def find(self, text: str, entity_type: Optional[EntityType] = None) -> list[str]:
        """Substring search over entity values."""
        needle = text.strip().lower()
        out = []
        for eid, data in self.g.nodes(data=True):
            if entity_type and data["entity_type"] != entity_type.value:
                continue
            if needle in data["value"]:
                out.append(eid)
        return sorted(out)

    def neighbours(self, eid: str) -> list[tuple[str, str, str]]:
        """(relation, other_entity, event_id) touching this entity, both ways."""
        out = []
        if eid not in self.g:
            return out
        for _, dst, data in self.g.out_edges(eid, data=True):
            out.append((data["relation"], dst, data["event_id"]))
        for src, _, data in self.g.in_edges(eid, data=True):
            out.append((f"{data['relation']}_by", src, data["event_id"]))
        return out

    def events_for_entity(self, eid: str) -> list[Event]:
        entity = self.entities.get(eid)
        if not entity:
            return []
        return [self.events[i] for i in entity.event_ids if i in self.events]

    def path_between(self, src: str, dst: str, cutoff: int = 6) -> list[list[dict]]:
        """Entity paths linking two entities, rendered as citable hops.

        Runs on the undirected projection: 'this user is connected to that IP'
        is a question about connectedness, and edge direction here is an
        artefact of how we phrased each relation, not of causality.
        """
        if src not in self.g or dst not in self.g:
            return []
        collapsed = self._collapsed()
        if not nx.has_path(collapsed, src, dst):
            return []

        paths: list[list[dict]] = []
        # Shortest first, and one route per distinct node path. Enumerating
        # every simple path depth-first would spend the whole budget on long
        # detours through common entities and never reach the direct route,
        # which is usually the one that answers the question.
        for node_path in nx.shortest_simple_paths(collapsed, src, dst):
            if len(node_path) - 1 > cutoff:
                break
            paths.append(self._hops_along(collapsed, node_path))
            if len(paths) >= 25:
                break

        # A route whose hops run forward in time tells a story; one that jumps
        # backwards is still a real connection but a weaker explanation, so
        # chronologically coherent routes are offered first.
        paths.sort(key=lambda hops: (not _is_chronological(hops), len(hops)))
        return paths[:10]

    def _collapsed(self) -> nx.Graph:
        """Undirected simple graph, each edge carrying every event behind it.

        Direction is dropped deliberately: 'is this file connected to that
        address' is a question about connectedness, and edge direction here
        reflects how each relation was phrased, not causality.
        """
        if self._collapsed_cache is not None:
            return self._collapsed_cache
        collapsed = nx.Graph()
        collapsed.add_nodes_from(self.g.nodes(data=True))
        for src, dst, data in self.g.edges(data=True):
            if collapsed.has_edge(src, dst):
                collapsed[src][dst]["support"].append(data)
            else:
                collapsed.add_edge(src, dst, support=[data])
        self._collapsed_cache = collapsed
        return collapsed

    @staticmethod
    def _hops_along(collapsed: nx.Graph, node_path: list[str]) -> list[dict]:
        """Pick one supporting event per hop, walking forward in time.

        Where several events justify the same hop, the earliest one at or after
        the previous hop is chosen, so the route reads as a sequence rather
        than as an arbitrary set of unrelated moments.
        """
        hops: list[dict] = []
        previous_ts = None
        for a, b in zip(node_path, node_path[1:]):
            candidates = sorted(
                collapsed[a][b]["support"], key=lambda d: d["timestamp"]
            )
            forward = [d for d in candidates if previous_ts is None or d["timestamp"] >= previous_ts]
            data = forward[0] if forward else candidates[0]
            previous_ts = data["timestamp"]
            hops.append({
                "from": a, "to": b,
                "relation": data["relation"],
                "event_id": data["event_id"],
                "timestamp": data["timestamp"],
            })
        return hops

    def activity_after(
        self, event_id: str, window: timedelta = timedelta(minutes=15)
    ) -> list[Event]:
        """Events sharing an entity with this one, within a following window.

        The entity overlap is what makes this more than a time slice: it is
        'what else did these same actors do next', not 'what else happened'.
        """
        anchor = self.events.get(event_id)
        if not anchor:
            return []
        anchor_entities = set(self._entities_of(anchor))
        out = []
        for ev in self.events.values():
            if ev.event_id == event_id:
                continue
            delta = ev.timestamp - anchor.timestamp
            if timedelta(0) <= delta <= window and anchor_entities & set(self._entities_of(ev)):
                out.append(ev)
        return sorted(out, key=lambda e: e.timestamp)

    def _entities_of(self, event: Event) -> list[str]:
        from .entities import entities_of

        return entities_of(event)

    def stats(self) -> dict:
        by_type: dict[str, int] = {}
        for _, data in self.g.nodes(data=True):
            by_type[data["entity_type"]] = by_type.get(data["entity_type"], 0) + 1
        return {
            "entities": self.g.number_of_nodes(),
            "relations": self.g.number_of_edges(),
            "by_type": by_type,
        }
