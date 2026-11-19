import accueilData from '../../content/accueil.json';
import ateliersData from '../../content/ateliers.json';
import bonjourData from '../../content/bonjour.json';
import ceramiquesData from '../../content/ceramiques.json';
import contactData from '../../content/contact.json';
import footerData from '../../content/footer.json';
import galerieData from '../../content/galerie.json';
import illustrationsData from '../../content/illustrations.json';
import loginData from '../../content/login.json';
import navigationData from '../../content/navigation.json';
import oeuvresData from '../../content/oeuvres.json';
import presseData from '../../content/presse.json';
import reservationData from '../../content/reservation.json';
import seoData from '../../content/seo.json';
import tarotData from '../../content/tarot.json';
import type {
  ArtworksContent,
  AteliersContent,
  BonjourContent,
  CeramiquesContent,
  ContactContent,
  FooterContent,
  GalleryContent,
  HomeContent,
  IllustrationsContent,
  LoginContent,
  NavigationContent,
  PresseContent,
  ReservationContent,
  SeoContent,
  TarotContent,
} from './schemas';

export const accueil = accueilData satisfies HomeContent;
export const ateliers = ateliersData satisfies AteliersContent;
export const bonjour = bonjourData satisfies BonjourContent;
export const ceramiques = ceramiquesData satisfies CeramiquesContent;
export const contact: ContactContent = contactData;
export const footer = footerData satisfies FooterContent;
export const galerie = galerieData satisfies GalleryContent;
export const illustrations = illustrationsData satisfies IllustrationsContent;
export const login = loginData satisfies LoginContent;
export const navigation = {
  ...navigationData,
  cta: navigationData.login.cta,
} satisfies NavigationContent;
export const oeuvres = oeuvresData satisfies ArtworksContent;
export const presse = presseData satisfies PresseContent;
export const reservation = reservationData satisfies ReservationContent;
export const seo: SeoContent = seoData;
export const tarot = tarotData satisfies TarotContent;
