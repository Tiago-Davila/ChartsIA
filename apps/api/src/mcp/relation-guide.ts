/** Qué flechas usar según el tipo de diagrama que pide la persona; lo comparten las herramientas y las guías. */
export const RELATIONS_BY_TYPE_GUIDE =
  'Tipo de flecha según el diagrama que la persona pide en su mensaje: UML o clases (class) → association, aggregation, composition, inheritance, realization, dependency; C4 → c4-rel; entidad-relación (er) → er-rel y er-attr; NoSQL → nosql-rel; flujo de sistema (flow) → flow-edge. Interpreta el tipo por lo que dice la persona y usa solo las flechas de ese tipo: si pide UML, no uses er-rel, er-attr ni connector entre clases. El servidor rechaza con RELATION_NOT_ALLOWED las relaciones que no corresponden al tipo del diagrama. connector queda para figuras y uniones libres (y la notación Chen).';

/** Pregunta que se hace en los diagramas de clases antes de crearlos. */
export const PSEUDOCODE_QUESTION =
  'En un diagrama de clases, antes de crearlo pregunta a la persona: "¿Querés que agregue pseudocódigo a los métodos?". Si dice que sí, escríbelo en un elemento kind text (bloque de código) junto a cada clase; si dice que no, no lo agregues.';
