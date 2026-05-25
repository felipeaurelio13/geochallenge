/**
 * Grupos de banderas visualmente similares.
 *
 * Usados por el modo Flag Master en los tiers de "similar distractors" y "combined":
 * cuando una pregunta pertenece a uno de estos grupos, las opciones distractoras
 * se eligen del mismo grupo para forzar al jugador a discriminar entre banderas
 * que comparten paleta, layout o motivos heráldicos.
 *
 * Los nombres deben coincidir EXACTAMENTE con `correctAnswer` en la tabla Question,
 * que en este proyecto se siembra desde `data/countries.json` (nombres en inglés).
 *
 * Cada país debería pertenecer como máximo a un grupo "primario" para evitar
 * ambigüedad en la búsqueda de distractores.
 */
export interface FlagSimilarityGroup {
  id: string;
  description: string;
  countries: string[];
}

export const FLAG_SIMILARITY_GROUPS: FlagSimilarityGroup[] = [
  {
    id: 'pan_slavic_horiz',
    description: 'Tricolor pan-eslavo horizontal (blanco-azul-rojo)',
    countries: ['Russia', 'Slovakia', 'Slovenia', 'Serbia', 'Croatia'],
  },
  {
    id: 'pan_arab_red_white_black',
    description: 'Pan-árabe horizontal (rojo-blanco-negro)',
    countries: ['Egypt', 'Syria', 'Iraq', 'Yemen', 'Sudan'],
  },
  {
    id: 'pan_arab_with_side_band',
    description: 'Pan-árabe con franja lateral de color',
    countries: ['Jordan', 'Kuwait', 'United Arab Emirates'],
  },
  {
    id: 'pan_african_red_yellow_green',
    description: 'Pan-africano (rojo-amarillo-verde)',
    countries: ['Ghana', 'Cameroon', 'Mali', 'Senegal', 'Guinea', 'Burkina Faso', 'Benin', 'Ethiopia'],
  },
  {
    id: 'nordic_cross',
    description: 'Cruz nórdica',
    countries: ['Norway', 'Sweden', 'Denmark', 'Finland', 'Iceland'],
  },
  {
    id: 'red_white_red_horiz',
    description: 'Rojo-blanco-rojo horizontal',
    countries: ['Austria', 'Latvia', 'Lebanon'],
  },
  {
    id: 'red_white_horiz',
    description: 'Rojo y blanco horizontal (Indonesia/Mónaco/Polonia invertida)',
    countries: ['Indonesia', 'Monaco', 'Poland'],
  },
  {
    id: 'blue_yellow_red_vert',
    description: 'Tricolor vertical azul-amarillo-rojo',
    countries: ['Romania', 'Chad', 'Andorra', 'Moldova'],
  },
  {
    id: 'green_white_red_vert',
    description: 'Tricolor vertical verde-blanco-rojo',
    countries: ['Italy', 'Mexico', 'Hungary', 'Bulgaria', 'Iran'],
  },
  {
    id: 'crescent_star_red',
    description: 'Media luna y estrella en fondo rojo',
    countries: ['Turkey', 'Tunisia', 'Algeria'],
  },
  {
    id: 'crescent_star_other',
    description: 'Media luna y estrella (otros fondos)',
    countries: ['Pakistan', 'Azerbaijan', 'Uzbekistan', 'Mauritania', 'Turkmenistan'],
  },
  {
    id: 'red_with_yellow_stars',
    description: 'Rojo con estrellas amarillas',
    countries: ['China', 'Vietnam'],
  },
  {
    id: 'blue_white_red_vert',
    description: 'Tricolor vertical azul-blanco-rojo',
    countries: ['France', 'Netherlands', 'Luxembourg', 'Paraguay'],
  },
  {
    id: 'white_blue_white_horiz',
    description: 'Bandera con franjas blanca-azul-blanca',
    countries: ['Argentina', 'Uruguay', 'Greece'],
  },
  {
    id: 'green_yellow_red_vert',
    description: 'Tricolor vertical verde-amarillo-rojo (LATAM)',
    countries: ['Bolivia', 'Colombia', 'Ecuador', 'Venezuela'],
  },
  {
    id: 'sun_with_face_horiz',
    description: 'Bandera horizontal con sol/escudo central',
    countries: ['Argentina', 'Uruguay', 'Kazakhstan'],
  },
  {
    id: 'red_with_white_cross',
    description: 'Cruz blanca en campo rojo',
    countries: ['Switzerland', 'Denmark', 'Tonga', 'Georgia'],
  },
];

/**
 * Indexa los grupos por nombre de país para lookup O(1) en hot path.
 */
const COUNTRY_TO_GROUPS: Map<string, FlagSimilarityGroup[]> = (() => {
  const map = new Map<string, FlagSimilarityGroup[]>();
  for (const group of FLAG_SIMILARITY_GROUPS) {
    for (const country of group.countries) {
      const existing = map.get(country);
      if (existing) {
        existing.push(group);
      } else {
        map.set(country, [group]);
      }
    }
  }
  return map;
})();

/**
 * Devuelve los grupos a los que pertenece un país (puede ser 0, 1 o varios).
 */
export function getSimilarityGroupsFor(country: string): FlagSimilarityGroup[] {
  return COUNTRY_TO_GROUPS.get(country) ?? [];
}

/**
 * Lista de TODOS los países que están en al menos un grupo de similitud.
 * Útil para filtrar la pool de preguntas cuando se necesita garantizar que
 * los distractores similares estén disponibles.
 */
export function getAllCountriesInGroups(): Set<string> {
  return new Set(COUNTRY_TO_GROUPS.keys());
}
