// Contact form. Sends straight to your inbox through Web3Forms once PUBLIC_WEB3FORMS_KEY is set
// (free key from https://web3forms.com; it is designed to be public). Until then it opens the visitor's email app.
import { PROFILE } from '@/data/site';
import { $, toast } from './dom';

const KEY: string = import.meta.env.PUBLIC_WEB3FORMS_KEY ?? '';

export function initContact(): void {
  const form = $<HTMLFormElement>('#contact-form');
  if (!form) return;
  const note = $('#form-note');
  const field = <T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(id: string) => $<T>(id)!;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (field<HTMLInputElement>('#f-bot').checked) return; // a bot filled the hidden field
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const name = field<HTMLInputElement>('#f-name').value.trim();
    const email = field<HTMLInputElement>('#f-email').value.trim();
    const subject = field<HTMLSelectElement>('#f-subject').value;
    const message = field<HTMLTextAreaElement>('#f-msg').value.trim();

    if (!KEY) {
      const body = `${message}\n\n— ${name} (${email})`;
      location.href = `mailto:${PROFILE.email}?subject=${encodeURIComponent(`${subject} from ${name}`)}&body=${encodeURIComponent(body)}`;
      if (note) note.textContent = 'Opening your email app...';
      toast('Message ready!', 'Your email app is opening with the message filled in.');
      form.reset();
      return;
    }

    if (btn) { btn.disabled = true; btn.style.opacity = '.7'; }
    if (note) note.textContent = 'Sending...';
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: KEY, subject: `${subject} from ${name} (portfolio)`, from_name: name, email, message, botcheck: false }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message ?? String(res.status));
      if (note) note.textContent = "Sent! I'll get back to you soon.";
      toast('Message sent!', 'Thanks for reaching out. I usually reply within a day or two.');
      form.reset();
    } catch {
      if (note) note.innerHTML = `Couldn't send right now. Email me directly at <a href="mailto:${PROFILE.email}">${PROFILE.email}</a>.`;
      toast('Message not sent', 'Something went wrong. Please email me directly.');
    } finally {
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    }
  });
}
