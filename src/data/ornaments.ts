import astrologyWheel from '../assets/ornaments/astrology-wheel.png';
import tarotStone from '../assets/ornaments/cartonancienne-pierre-tarot.webp';
import paperIllustrations from '../assets/ornaments/cartonancienne-papier-illustrations.webp';
import celestialCrab from '../assets/ornaments/celestial-crab.png';
import celestialMoth from '../assets/ornaments/celestial-moth.png';
import celestialWatch from '../assets/ornaments/celestial-watch.png';
import crescentMoon from '../assets/ornaments/crescent-moon.png';
import curiosityBellJar from '../assets/ornaments/curiosity-bell-jar.png';
import handStar from '../assets/ornaments/hand-star.png';
import lilyPen from '../assets/ornaments/lily-pen.png';
import lunarSnake from '../assets/ornaments/lunar-snake.png';
import marineAmphora from '../assets/ornaments/marine-amphora.png';
import moonDoorway from '../assets/ornaments/moon-doorway.png';
import moonKey from '../assets/ornaments/moon-key.png';
import mysticEye from '../assets/ornaments/mystic-eye.png';
import phoenixFeather from '../assets/ornaments/phoenix-feather.png';
import radiantSun from '../assets/ornaments/radiant-sun.png';
import risingPhoenix from '../assets/ornaments/rising-phoenix.png';
import sealedEnvelope from '../assets/ornaments/sealed-envelope.png';
import severineProfile from '../assets/ornaments/severine-profile.png';
import shellCoral from '../assets/ornaments/shell-coral.png';
import workshopTools from '../assets/ornaments/workshop-tools.png';
import presse from '../assets/ornaments/presse.png';
import pierre from '../assets/ornaments/pierre.png';
import papier from '../assets/ornaments/papier.png';
import ciseaux from '../assets/ornaments/ciseaux.png';

export const ornaments = {
  astrologyWheel,
  tarotStone,
  paperIllustrations,
  celestialCrab,
  celestialMoth,
  celestialWatch,
  crescentMoon,
  curiosityBellJar,
  handStar,
  lilyPen,
  lunarSnake,
  marineAmphora,
  moonDoorway,
  moonKey,
  mysticEye,
  phoenixFeather,
  radiantSun,
  risingPhoenix,
  sealedEnvelope,
  severineProfile,
  shellCoral,
  workshopTools,
  presse,
  pierre,
  papier,
  ciseaux,
} as const;

export const ornamentCatalog = [
  { slug: 'pierre', label: 'Pierre', section: 'Services', asset: pierre },
  { slug: 'papier', label: 'Papier', section: 'Services', asset: papier },
  { slug: 'ciseaux', label: 'Ciseaux', section: 'Services', asset: ciseaux },
  { slug: 'crescent-moon', label: 'Croissant de lune', section: 'Tarot', asset: crescentMoon },
  { slug: 'mystic-eye', label: 'Œil mystique', section: 'Tarot', asset: mysticEye },
  { slug: 'hand-star', label: 'Main étoilée', section: 'Ateliers', asset: handStar },
  { slug: 'radiant-sun', label: 'Soleil rayonnant', section: 'Tarot', asset: radiantSun },
  { slug: 'celestial-moth', label: 'Papillon céleste', section: 'Illustrations', asset: celestialMoth },
  { slug: 'lunar-snake', label: 'Serpent lunaire', section: 'Tarot', asset: lunarSnake },
  { slug: 'moon-key', label: 'Clé lunaire', section: 'Espace privé', asset: moonKey },
  { slug: 'shell-coral', label: 'Coquillage et corail', section: 'Céramiques', asset: shellCoral },
  { slug: 'celestial-crab', label: 'Crabe céleste', section: 'Céramiques', asset: celestialCrab },
  { slug: 'phoenix-feather', label: 'Plume du Phénix', section: 'Atelier', asset: phoenixFeather },
  { slug: 'rising-phoenix', label: 'Phénix', section: 'Espace privé', asset: risingPhoenix },
  { slug: 'lily-pen', label: 'Lys et plume', section: 'Illustrations', asset: lilyPen },
  { slug: 'marine-amphora', label: 'Amphore marine', section: 'Céramiques', asset: marineAmphora },
  { slug: 'astrology-wheel', label: 'Roue astrologique', section: 'Tarot', asset: astrologyWheel },
  { slug: 'workshop-tools', label: 'Outils de l’atelier', section: 'Ateliers', asset: workshopTools },
  { slug: 'curiosity-bell-jar', label: 'Cabinet sous cloche', section: 'Cabinet', asset: curiosityBellJar },
  { slug: 'celestial-watch', label: 'Montre céleste', section: 'Réservation', asset: celestialWatch },
  { slug: 'severine-profile', label: 'Profil de Séverine', section: 'À propos', asset: severineProfile },
  { slug: 'sealed-envelope', label: 'Lettre cachetée', section: 'Contact', asset: sealedEnvelope },
  { slug: 'moon-doorway', label: 'Porte lunaire', section: 'Accueil', asset: moonDoorway },
] as const;
