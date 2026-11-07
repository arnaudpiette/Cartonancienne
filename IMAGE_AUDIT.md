# Inventaire et optimisation

| Visuel utilisé | Original | Poids source | Traitement de production |
|---|---:|---:|---|
| Bureau de l’atelier | `IMG_9572.jpeg` | 2 175 369 o | WebP responsive, 768–2400 px, prioritaire |
| Œuf alchimique | `Oeuf_verso.png` | 1 695 298 o | WebP responsive, 600–1200 px, prioritaire |
| Crabe gravé | `Soit_Crabe copie.png` | 2,2 Mo | WebP responsive, 300–500 px |
| Portrait | `SeverinePiette-03...jpg` | 8,4 Mo | WebP responsive, différé |
| Illustration | `Picto_APIER...jpg` | 1,7 Mo | WebP responsive, différé |
| Céramique | `Crabes_love_dad.png` | 2,7 Mo | WebP responsive, différé |
| Tarot | `PRINT_Le_Bon_Tarot...jpg` | 724 Ko | WebP responsive, différé |

Les originaux ont été dédoublonnés par sélection d’usage : la presse présente deux copies du même groupe de visuels, non intégrées au build. En vérification locale SSR, l’œuf WebP 600×777 pèse **37 612 o** (−97,8 % comparé au PNG original) et le bureau WebP 1200×900 **146 132 o** (−93,3 % comparé au JPEG original). Astro produit les autres tailles WebP à la demande via `/_image`; aucun original n’est écrasé.
