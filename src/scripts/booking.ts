import { bookingServices, formatParis, isBookingService, parisDay } from '../data/booking';
import { reservation } from '../lib/content';

type Slot = { start_at: string; end_at: string };
type BookingResult = { id: string; startAt: string; duration: number; price: number; notification: 'sent' | 'pending' | 'simulation' };

export function initBooking() {
  const root = document.querySelector<HTMLElement>('#booking');
  if (!root) return;
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const form = get<HTMLFormElement>('#booking-form');
  const panels = [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const error = get<HTMLElement>('#booking-error');
  const day = get<HTMLInputElement>('#booking-day');
  const options = get<HTMLElement>('#slots-options');
  const status = get<HTMLElement>('#slots-status');
  const retry = get<HTMLButtonElement>('#slots-retry');
  const submit = get<HTMLButtonElement>('#booking-submit');
  let step = 1;
  let slots: Slot[] = [];
  let startAt = '';
  let busy = false;
  let requestId = '';
  let submittedPayload = '';
  let controller: AbortController | undefined;
  const service = () => new FormData(form).get('service')?.toString();
  const selectedOffer = () => { const slug = service(); return isBookingService(slug) ? bookingServices[slug] : null; };
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;

  function clearError() { error.hidden = true; error.textContent = ''; }
  function showError(message: string) { error.textContent = message; error.hidden = false; error.focus(); }
  function showStep(next: number) {
    step = next;
    clearError();
    panels.forEach((panel, index) => { panel.hidden = index + 1 !== step; });
    root!.querySelectorAll('[data-progress]').forEach((item, index) => {
      if (index + 1 === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    get<HTMLElement>(`#step-${step}-title`).focus({ preventScroll: true });
    const top = root!.getBoundingClientRect().top;
    if (top < 0) root!.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function updateSlotButton() {
    get<HTMLButtonElement>('[data-step="2"] [data-next]').disabled = !slots.some(slot => slot.start_at === startAt);
  }
  async function loadSlots() {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    const previous = startAt;
    startAt = '';
    slots = [];
    updateSlotButton();
    options.replaceChildren();
    get<HTMLElement>('#slots-fieldset').hidden = true;
    get<HTMLElement>('#booking-slots').setAttribute('aria-busy', 'false');
    retry.hidden = true;
    const offer = selectedOffer();
    get<HTMLElement>('[data-service-context]').textContent = offer ? `${offer.title} · ${offer.duration} ${reservation.messages.serviceDurationUnit} · ${offer.price} €` : '';
    if (!day.value || !day.validity.valid || day.value < parisDay()) {
      status.textContent = reservation.messages.invalidDate;
      return;
    }
    status.textContent = reservation.messages.searchingSlots;
    get<HTMLElement>('#booking-slots').setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(`/api/reservations?${new URLSearchParams({ service: service() || '', day: day.value })}`, { signal: current.signal, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || reservation.messages.availabilityUnavailable);
      if (controller !== current) return;
      slots = data.slots;
      startAt = slots.some(slot => slot.start_at === previous) ? previous : '';
      const formatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
      for (const slot of slots) {
        const label = document.createElement('label');
        label.className = 'booking-slot';
        const input = document.createElement('input');
        input.type = 'radio'; input.name = 'startAt'; input.value = slot.start_at; input.checked = slot.start_at === startAt;
        input.addEventListener('change', () => { startAt = input.value; updateSlotButton(); });
        label.append(input, document.createTextNode(formatter.format(new Date(slot.start_at))));
        options.append(label);
      }
      get<HTMLElement>('#slots-fieldset').hidden = !slots.length;
      status.textContent = slots.length ? `${slots.length} ${slots.length === 1 ? reservation.messages.availableSlot : reservation.messages.availableSlots}` : reservation.messages.noAvailability;
      updateSlotButton();
    } catch (cause) {
      if (current.signal.aborted) return;
      status.textContent = cause instanceof Error ? cause.message : reservation.messages.availabilityLoadFailed;
      retry.hidden = false;
    } finally {
      if (controller === current) get<HTMLElement>('#booking-slots').setAttribute('aria-busy', 'false');
    }
  }
  function validateDetails() {
    let firstInvalid: HTMLInputElement | undefined;
    for (const name of ['firstName', 'lastName', 'email'] as const) {
      const input = field(name);
      input.value = input.value.trim();
      const valid = input.checkValidity();
      input.setAttribute('aria-invalid', String(!valid));
      get<HTMLElement>(`#${name}-error`).textContent = valid ? '' : reservation.messages.fieldErrors[name];
      if (!valid && !firstInvalid) firstInvalid = input;
    }
    if (firstInvalid) { showError(reservation.messages.detailsError); firstInvalid.focus(); return false; }
    return true;
  }
  function summary(target: HTMLElement, result?: BookingResult) {
    const offer = selectedOffer();
    if (!offer) return;
    const rows = [
      [reservation.summaryLabels.service, offer.title], [reservation.summaryLabels.duration, `${result?.duration ?? offer.duration} ${reservation.messages.serviceDurationUnit}`],
      [reservation.summaryLabels.appointment, `${formatParis(result?.startAt ?? startAt)} · ${reservation.summaryLabels.timezone}`],
      [reservation.summaryLabels.price, `${result?.price ?? offer.price} €`],
      [reservation.summaryLabels.contact, `${field('firstName').value} ${field('lastName').value}\n${field('email').value}`],
    ];
    target.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value; row.append(dt, dd); return row;
    }));
  }
  function next() {
    if (busy) return;
    if (step === 1 && selectedOffer()) { showStep(2); void loadSlots(); }
    else if (step === 2 && slots.some(slot => slot.start_at === startAt)) showStep(3);
    else if (step === 3 && validateDetails()) { summary(get('#booking-summary')); showStep(4); }
  }
  root.querySelectorAll<HTMLButtonElement>('[data-next]').forEach(button => button.addEventListener('click', next));
  root.querySelectorAll<HTMLButtonElement>('[data-back]').forEach(button => button.addEventListener('click', () => {
    if (busy) return;
    showStep(step - 1);
    if (step === 2) void loadSlots();
  }));
  root.querySelectorAll<HTMLInputElement>('[name="service"]').forEach(input => input.addEventListener('change', () => {
    controller?.abort(); startAt = ''; slots = [];
    get<HTMLButtonElement>('[data-step="1"] [data-next]').disabled = false;
  }));
  day.addEventListener('change', () => { startAt = ''; void loadSlots(); });
  retry.addEventListener('click', () => { void loadSlots(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (step !== 4) { next(); return; }
    if (!validateDetails() || !selectedOffer() || !startAt) return;
    const payload = { service: service(), startAt, firstName: field('firstName').value, lastName: field('lastName').value, email: field('email').value };
    const fingerprint = JSON.stringify(payload);
    if (!requestId || fingerprint !== submittedPayload) { requestId = crypto.randomUUID(); submittedPayload = fingerprint; }
    busy = true;
    clearError();
    form.setAttribute('aria-busy', 'true');
    submit.disabled = true;
    get<HTMLButtonElement>('[data-step="4"] [data-back]').disabled = true;
    get<HTMLElement>('#booking-submit-status').textContent = reservation.messages.submitPending;
    try {
      const response = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestId }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) { startAt = ''; showStep(2); await loadSlots(); }
        showError(data.error || reservation.messages.submitError);
        return;
      }
      const result = data.booking as BookingResult;
      if (!result?.id || !result.startAt) throw new Error('invalid_response');
      form.hidden = true;
      get<HTMLElement>('#booking-progress').hidden = true;
      summary(get('#confirmed-summary'), result);
      get<HTMLElement>('#booking-mail-status').textContent = result.notification === 'sent' ? reservation.messages.mailStatus.sent : result.notification === 'simulation' ? reservation.messages.mailStatus.simulation : reservation.messages.mailStatus.pending;
      get<HTMLElement>('#booking-confirmed').hidden = false;
      get<HTMLElement>('#confirmed-title').focus();
    } catch {
      showError(reservation.messages.serverResponseError);
    } finally {
      busy = false;
      form.setAttribute('aria-busy', 'false'); submit.disabled = false;
      get<HTMLButtonElement>('[data-step="4"] [data-back]').disabled = false;
      get<HTMLElement>('#booking-submit-status').textContent = '';
    }
  });
}
