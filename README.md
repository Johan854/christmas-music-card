# Christmas Music Card (FR)

Carte Home Assistant « musique de Noël » : disque vinyle qui tourne et égaliseur animé quand la musique joue, volume (curseur), coupure du son, réveil de Noël (automatisation) et image de fond au choix. Style verre, thème clair/sombre automatique, éditeur visuel, textes en français.

## Installation (HACS)
HACS → ⋮ → Dépôts personnalisés → `https://github.com/Johan854/christmas-music-card`, catégorie **Tableau de bord**. Puis recharger le navigateur.

## Exemple
```yaml
type: custom:christmas-music-card
music_entity: switch.esp_suite_musique_de_noel
mute_entity: switch.esp_suite_mute_toggle
volume_entity: number.esp_suite_volume_dfplayer_suite_2
alarm_entity: automation.nouvelle_automatisation
alarm_name: Réveil de Noël
subtitle: All I Want for Christmas Is You
image: /local/noel.jpg
```

## Options
| Option | Défaut | Description |
|---|---|---|
| `music_entity` | obligatoire | Interrupteur qui lance / arrête la musique |
| `mute_entity` | | Interrupteur « couper le son » |
| `volume_entity` | | `number` / `input_number` du volume (curseur) |
| `alarm_entity` | | Automatisation du réveil (interrupteur, date du dernier déclenchement) |
| `alarm_name` | `Réveil de Noël` | Nom du réveil |
| `name`, `subtitle` | `Musique de Noël`, vide | Titre et sous-titre (par ex. le morceau) |
| `image`, `image_opacity` | vide, `0.35` | Image de fond (URL ou `/local/...`) et son opacité |
| `snow` | `true` | Flocons animés |
| `theme` | `auto` | `auto`, `light`, `dark` |

Le bloc « Nuance de couleur » est identique à celui des autres cartes.
