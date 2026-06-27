import { defineLiveCollection } from "astro:content";
import { emdashLoader } from "emdash/runtime";

// Registers EmDash as a live (request-time) content source. Content authored in
// the EmDash admin is read through this loader via getEmDashCollection/getEmDashEntry.
export const collections = {
  _emdash: defineLiveCollection({
    loader: emdashLoader(),
  }),
};
