// Copied from forensic-agent/report.md (CASE_001, generated 2026-09-24 by the Forensic Agent pipeline).
// INC-01 is the first correlated chain; the later events are ordinary activity from the same timeline.
// Stages follow EVENT_STAGE in forensics/schema.py. sev: h = high, m = medium, l = low, '' = not flagged.
// basis is the report's rule-based reason; empty where the report gives none.

export interface CaseEvent { id: string; at: string; type: string; who: string; detail: string; sev: 'h' | 'm' | 'l' | ''; stage: string; basis: string; inc?: boolean }

const OFF = 'occurred at 02:xx UTC, outside business hours';

export const CASE001 = {
  summary: { events: 527, sources: 5, entities: 60, relations: 934, flagged: 95, high: 10, chains: 2, skew: '-37.0 s', anchors: 17 },
  incident: {
    id: 'INC-01', window: '2026-09-20 02:09:00 to 02:15:58 UTC', stages: ['access', 'escalation', 'execution', 'collection', 'exfiltration', 'cleanup'],
    score: '1.00', confidence: '0.95', host: 'wks-04',
    basis: [
      'spans 6 investigative stages (access -> escalation -> execution -> collection -> exfiltration -> cleanup)',
      '15 of 15 events independently flagged as anomalous',
      'activity compressed into 7.0 minutes',
      'stages occur in escalating order, consistent with a single sequence',
    ],
  },
  events: [
    { id: 'AUTH-00036', at: '02:09:00', type: 'login_failure', who: 'meera', detail: '', sev: 'm', stage: 'access', basis: '', inc: true },
    { id: 'AUTH-00037', at: '02:09:11', type: 'login_failure', who: 'meera', detail: '', sev: 'm', stage: 'access', basis: '', inc: true },
    { id: 'AUTH-00038', at: '02:09:22', type: 'login_failure', who: 'meera', detail: '', sev: 'm', stage: 'access', basis: '', inc: true },
    { id: 'AUTH-00039', at: '02:09:33', type: 'login_failure', who: 'meera', detail: '', sev: 'm', stage: 'access', basis: '', inc: true },
    { id: 'AUTH-00040', at: '02:09:52', type: 'login_success', who: 'meera', detail: '', sev: 'h', stage: 'access', basis: `${OFF}; successful login preceded by 4 failures within 10 minutes`, inc: true },
    { id: 'AUTH-00041', at: '02:10:33', type: 'priv_escalation', who: 'meera', detail: 'python3', sev: 'm', stage: 'escalation', basis: `${OFF}; privilege escalation recorded`, inc: true },
    { id: 'PROCESS-00108', at: '02:10:33', type: 'process_start', who: 'meera', detail: 'python3 /usr/bin/python3', sev: 'm', stage: 'execution', basis: '', inc: true },
    { id: 'FILE_EVENTS-00136', at: '02:11:04', type: 'file_read', who: 'meera', detail: 'python3 /srv/finance/payroll_2026.xlsx (19.6 MB)', sev: 'm', stage: 'collection', basis: OFF, inc: true },
    { id: 'FILE_EVENTS-00137', at: '02:11:56', type: 'file_read', who: 'meera', detail: 'python3 /srv/finance/vendor_contracts.pdf (28.4 MB)', sev: 'm', stage: 'collection', basis: OFF, inc: true },
    { id: 'FILE_EVENTS-00138', at: '02:12:52', type: 'file_read', who: 'meera', detail: 'python3 /srv/hr/employee_records.csv (16.6 MB)', sev: 'm', stage: 'collection', basis: OFF, inc: true },
    { id: 'PROCESS-00109', at: '02:13:27', type: 'process_start', who: 'meera', detail: 'tar /usr/bin/tar', sev: 'm', stage: 'execution', basis: `${OFF}; archiving utility used (tar)`, inc: true },
    { id: 'FILE_EVENTS-00139', at: '02:13:45', type: 'archive_create', who: 'meera', detail: 'tar /tmp/.cache_7867.tar.gz (812.0 MB)', sev: 'h', stage: 'collection', basis: `${OFF}; archiving utility used (tar); archive created at /tmp/.cache_7867.tar.gz (812 MB on disk)`, inc: true },
    { id: 'NETWORK-00112', at: '02:14:29', type: 'net_connect', who: 'meera', detail: '-> 203.0.113.140:8443', sev: 'h', stage: 'network', basis: OFF, inc: true },
    { id: 'NETWORK-00113', at: '02:14:55', type: 'net_transfer', who: 'meera', detail: '-> 203.0.113.140:8443, 812.4 MB out', sev: 'h', stage: 'exfiltration', basis: `${OFF}; outbound transfer of 812.4 MB`, inc: true },
    { id: 'FILE_EVENTS-00140', at: '02:15:58', type: 'file_delete', who: 'meera', detail: 'bash /tmp/.cache_7867.tar.gz (812.0 MB)', sev: 'h', stage: 'cleanup', basis: `${OFF}; file deleted outside business hours`, inc: true },
    { id: 'AUTH-00010', at: '09:28:00', type: 'login_success', who: 'meera', detail: '', sev: '', stage: 'access', basis: '' },
    { id: 'AUTH-00007', at: '09:45:00', type: 'login_success', who: 'rahul', detail: '', sev: 'l', stage: 'access', basis: '' },
    { id: 'AUTH-00014', at: '09:52:00', type: 'login_success', who: 'sysops', detail: '', sev: 'l', stage: 'access', basis: '' },
    { id: 'PROCESS-00043', at: '10:00:00', type: 'process_start', who: 'meera', detail: 'node /usr/bin/node', sev: '', stage: 'execution', basis: '' },
    { id: 'FILE_EVENTS-00027', at: '10:00:00', type: 'file_create', who: 'rahul', detail: 'python3 /var/log/app/app.log', sev: '', stage: 'collection', basis: '' },
    { id: 'FILE_EVENTS-00023', at: '10:07:00', type: 'file_write', who: 'rahul', detail: 'code /home/rahul/project/main.py', sev: '', stage: 'collection', basis: '' },
    { id: 'BROWSER_HIST-00031', at: '10:12:00', type: 'browser_visit', who: 'rahul', detail: 'chrome -> github.com', sev: '', stage: 'browsing', basis: '' },
    { id: 'NETWORK-00030', at: '10:12:00', type: 'net_connect', who: 'rahul', detail: '-> 10.0.1.7:443', sev: '', stage: 'network', basis: '' },
    { id: 'FILE_EVENTS-00024', at: '10:19:00', type: 'file_read', who: 'rahul', detail: 'code /srv/share/team-plan.xlsx', sev: '', stage: 'collection', basis: '' },
    { id: 'FILE_EVENTS-00048', at: '10:23:00', type: 'file_write', who: 'meera', detail: 'code /srv/share/team-plan.xlsx', sev: '', stage: 'collection', basis: '' },
    { id: 'BROWSER_HIST-00036', at: '10:32:00', type: 'browser_visit', who: 'meera', detail: 'chrome -> docs.internal.example', sev: '', stage: 'browsing', basis: '' },
  ] as CaseEvent[],
  questions: [
    { q: 'How did someone get into the account? Click the event that shows it.', answer: 'AUTH-00040', why: 'A successful login at 02:09 UTC, right after four failures in 33 seconds.' },
    { q: 'Which event moved the data off the machine?', answer: 'NETWORK-00113', why: '812.4 MB sent to an outside address, the same size as the archive built a minute earlier.' },
    { q: 'How were the tracks covered?', answer: 'FILE_EVENTS-00140', why: 'The archive was deleted one minute after the transfer finished.' },
  ],
};
