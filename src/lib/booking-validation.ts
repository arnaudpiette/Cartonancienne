import { isBookingService } from '../data/booking';

export function validateBooking(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const text = (key: string) => typeof input[key] === 'string' ? input[key].trim() : '';
  const service = text('service');
  const startAt = text('startAt');
  const firstName = text('firstName');
  const lastName = text('lastName');
  const email = text('email').toLowerCase();
  const requestId = text('requestId');
  const customerName = `${firstName} ${lastName}`;
  if (!isBookingService(service) || !firstName || firstName.length > 60 || !lastName || lastName.length > 59 ||
      customerName.length > 120 || /[\u0000-\u001f\u007f]/.test(customerName) ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(startAt) || Number.isNaN(Date.parse(startAt)) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return null;
  return { service, startAt: new Date(startAt).toISOString(), customerName, email, requestId };
}
