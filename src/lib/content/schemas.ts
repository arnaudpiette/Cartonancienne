export interface LinkContent {
  href: string;
  label: string;
}

export interface HomeContent {
  brandSignature: string;
  hero: { titleLines: string[]; eggAlt: string; scrollLabel: string };
  atelier: { imageAlt: string; caption: string };
  gallery: { title: string; linksLabel: string; illustrationsHref: string; illustrationsLink: string; ceramicsHref: string; ceramicsLink: string };
  splitLinks: {
    illustrations: { href: string; eyebrow: string; title: string; link: string };
    tarot: { href: string; eyebrow: string; title: string; link: string };
    workshops: { href: string; eyebrow: string; title: string; link: string };
  };
  about: { href: string; eyebrow: string; title: string; link: string; portraitAlt: string };
  press: { href: string; eyebrow: string; title: string; description: string; link: string };
  contact: { href: string; description: string; link: string };
}

export interface BonjourContent {
  intro: { eyebrow: string; title: string; lead: string; practices: string };
  portrait: { alt: string; caption: string };
  sections: { title: string; paragraphs: string[] }[];
  closing: string;
  atelier: { alt: string; caption: string };
  links: { ariaLabel: string; eyebrow: string; items: LinkContent[] };
}

export interface TarotContent {
  intro: { eyebrow: string; title: string; imageAlt: string; paragraphs: string[]; linkHref: string; link: string };
  offersHeading: { eyebrow: string; title: string };
  pricingDurationUnit: string;
  bookingServices: {
    solo: { title: string; description: string; price: number; duration: number };
    astrologicalWheel: { title: string; description: string; price: number; duration: number };
  };
  offers: {
    solo: { number: string; status: string; title: string; link: string };
    astrologicalWheel: { number: string; status: string; title: string; link: string };
    event: { number: string; title: string; description: string; link: string; contactMotif: string };
    gift: { number: string; title: string; description: string; link: string; contactMotif: string };
  };
  editorial: { eyebrow: string; title: string; paragraphs: string[]; galleryLabel: string };
}

export interface AteliersContent {
  intro: { eyebrow: string; title: string; description: string };
  cards: { eyebrow: string; title: string; description: string; imageAlt?: string }[];
  workshopActions: {
    ariaLabel: string;
    dates: { eyebrow: string; title: string; description: string; link: string; contactMotif: string };
    privatisation: { eyebrow: string; title: string; description: string; link: string; contactMotif: string };
  };
  editorial: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    galleryGroups: { slug: string; title: string }[];
    finalLink: string;
    finalContactMotif: string;
  };
}

export interface ContactMotive {
  label: string;
  subject: string;
  body: string;
}

export interface ContactContent {
  email: string;
  intro: { eyebrow: string; title: string; description: string };
  selection: { eyebrow: string; description: string; openLink: string; returnHref: string; returnLink: string };
  choices: {
    eyebrow: string;
    title: string;
    items: { number: string; title: string; description: string; links: { motif: string; label: string }[] }[];
  };
  direct: {
    name: string;
    phone: string;
    phoneHref: string;
    instagramHandle: string;
    instagramHref: string;
    reservationHref: string;
    reservationLink: string;
    locationAlt: string;
  };
  motives: Record<string, ContactMotive>;
}

export interface NavigationContent {
  brand: { homeHref: string; leading: string; emphasis: string; homeLabel: string };
  links: LinkContent[];
  desktopAriaLabel: string;
  mobileAriaLabel: string;
  login: LinkContent;
  menu: { openLabel: string; closeLabel: string };
}

export interface FooterContent {
  homeHref: string;
  homeLabel: string;
  copyright: string;
  press: LinkContent;
  contact: LinkContent;
}

export interface SeoContent {
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  pageTitles: Record<string, string>;
}

export interface GalleryContent {
  eyebrow: string;
  filters: { ariaLabel: string; all: string; illustrations: string; ceramics: string };
  emptyState: string;
  cardLink: string;
  editorialImageAltSeparator: string;
  detail: { backLink: string; yearLabel: string; creditLabel: string };
}

export interface ArtworkContent {
  slug: string;
  title: string;
  category: string;
  categoryLabel: string;
  alt: string;
  credit: string;
  description: string;
}

export interface ArtworksContent {
  artworks: ArtworkContent[];
}

export interface IllustrationsContent {
  intro: { eyebrow: string; title: string; description: string };
  galleryTitle: string;
  portfolio: { eyebrow: string; title: string; galleryLabel: string; downloadHref: string; downloadLink: string; projectHref: string; projectLink: string };
}

export interface CeramiquesContent {
  intro: { eyebrow: string; title: string; description: string };
  galleryTitle: string;
  editorial: {
    title: string;
    paragraphs: string[];
    videoSrc: string;
    videoFallback: string;
    commissionHref: string;
    commissionLink: string;
    collectionsTitle: string;
    collections: { slug: string; title: string; description?: string }[];
  };
}

export interface PresseContent {
  eyebrow: string;
  title: string;
  description: string;
  linksLabel: string;
  links: (LinkContent & { external: boolean })[];
  galleryLabel: string;
}

export interface ReservationContent {
  intro: { eyebrow: string; title: string };
  noscript: { beforeLink: string; contactHref: string; link: string; afterLink: string };
  progress: { ariaLabel: string; labels: string[] };
  steps: {
    service: { eyebrow: string; title: string; legend: string; servicePrefix: string; selectedLabel: string };
    date: { eyebrow: string; title: string; dateLabel: string; slotsLegend: string };
    details: {
      eyebrow: string;
      title: string;
      firstNameLabel: string;
      lastNameLabel: string;
      emailLabel: string;
      privacyBeforeLink: string;
      privacyContactHref: string;
      privacyLink: string;
    };
    confirmation: { eyebrow: string; title: string; submit: string };
  };
  buttons: { continue: string; back: string; retry: string };
  paymentOnSite: string;
  confirmation: { eyebrow: string; title: string; questionHref: string; questionLink: string };
  messages: {
    invalidDate: string;
    searchingSlots: string;
    availabilityUnavailable: string;
    availableSlot: string;
    availableSlots: string;
    noAvailability: string;
    availabilityLoadFailed: string;
    fieldErrors: { firstName: string; lastName: string; email: string };
    detailsError: string;
    submitPending: string;
    submitError: string;
    serverResponseError: string;
    mailStatus: { sent: string; simulation: string; pending: string };
    serviceDurationUnit: string;
  };
  summaryLabels: { service: string; duration: string; appointment: string; price: string; contact: string; timezone: string };
}

export interface LoginContent {
  eyebrow: string;
  title: string;
  errors: { notConfigured: string; invalidCredentials: string };
  usernameLabel: string;
  passwordLabel: string;
  showPassword: string;
  hidePassword: string;
  submit: string;
}
