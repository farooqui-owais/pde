/**
 * Centralized English → Marathi field-pair configuration.
 *
 * Each form registers its pairs here. To add a new auto-translated pair,
 * append `{ en: "english_field", mr: "marathi_field" }` to the form's array —
 * no component changes required (the hook wires everything automatically).
 */

export const TRANSLATION_PAIRS = {
  PartyDetails: [
    { en: "surname_en", mr: "surname_mr" },
    { en: "first_name_en", mr: "first_name_mr" },
    { en: "middle_name_en", mr: "middle_name_mr" },
    { en: "alias_name_en", mr: "alias_name_mr" },
    { en: "flat_no_en", mr: "flat_no_mr" },
    { en: "floor_no_en", mr: "floor_no_mr" },
    { en: "building_name_en", mr: "building_name_mr" },
    { en: "block_sector_en", mr: "block_sector_mr" },
    { en: "road_en", mr: "road_mr" },
    // English side is a dropdown → Marathi side is an editable text box
    // that gets auto-filled from the selected English value.
    { en: "state_en", mr: "state_mr" },
    { en: "city_en", mr: "city_mr" },
    { en: "district_name", mr: "district_mr" },
  ],

  IdentificationDetails: [
    { en: "surname_en", mr: "surname_mr" },
    { en: "first_name_en", mr: "first_name_mr" },
    { en: "middle_name_en", mr: "middle_name_mr" },
    { en: "address_en", mr: "address_mr" },
  ],

  PropertyDetails: [
    { en: "flat_no_en", mr: "flat_no_mr" },
    { en: "floor_no_en", mr: "floor_no_mr" },
    { en: "building_name_en", mr: "building_name_mr" },
    { en: "block_sector_en", mr: "block_sector_mr" },
    { en: "road_en", mr: "road_mr" },
    { en: "eother_desc", mr: "other_desc" },
    { en: "other_right_en", mr: "other_right_mr" },
    { en: "boundaries_en", mr: "boundaries_mr" },
  ],
};
