/**
 * Maharashtra reference/master data used by the PDE property form.
 * Single source of truth so the page component stays lean and the
 * District -> Taluka -> Village dropdown hierarchy is data-driven.
 *
 * All values are the bilingual labels that are actually persisted to the
 * backend (e.g. `village_name`, `taluka`), so they match what is shown in the
 * property grid and printed report.
 */

export const MAHARASHTRA_DISTRICTS = [
  "Pune",
  "Mumbai City",
  "Mumbai Suburban",
  "Thane",
  "Nashik",
  "Nagpur",
  "Latur",
  "Satara",
  "Kolhapur",
  "Solapur",
  "Ahmednagar",
  "Aurangabad (Chhatrapati Sambhaji Nagar)",
  "Nanded",
  "Amravati",
  "Jalgaon",
  "Raigad",
  "Palghar",
  "Ratnagiri",
  "Sindhudurg",
  "Sangli",
  "Beed",
  "Osmanabad (Dharashiv)",
  "Parbhani",
  "Jalna",
  "Hingoli",
  "Buldhana",
  "Akola",
  "Washim",
  "Yavatmal",
  "Wardha",
  "Chandrapur",
  "Gadchiroli",
  "Bhandara",
  "Gondia",
  "Dhule",
  "Nandurbar",
];

/**
 * Talukas grouped by district. The property form uses these to drive a
 * dynamic "Select Taluka" dropdown instead of a fixed Pune-only list.
 */
export const MAHARASHTRA_TALUKAS = {
  "Pune": [
    "Haveli / हवेली",
    "Pune City / पुणे शहर",
    "Mulshi / मुळशी",
    "Maval / मावळ",
    "Bhor / भोर",
    "Velhe / वेल्हे",
    "Purandar / पुरंदर",
    "Baramati / बारामती",
    "Indapur / इंदापूर",
    "Daund / दौंड",
    "Shirur / शिरूर",
    "Junnar / जुन्नर",
    "Ambegaon / आंबेगाव",
    "Khed / खेड",
  ],
  "Mumbai City": ["Mumbai City / मुंबई शहर"],
  "Mumbai Suburban": ["Mumbai Suburban / मुंबई उपनगर"],
  "Thane": [
    "Thane / ठाणे",
    "Kalyan / कल्याण",
    "Bhiwandi / भिवंडी",
    "Ulhasnagar / उल्हासनगर",
    "Murbad / मुरबाड",
    "Shahapur / शहापूर",
    "Ambernath / अंबरनाथ",
  ],
  "Nashik": [
    "Nashik / नाशिक",
    "Malegaon / मालेगाव",
    "Niphad / निफाड",
    "Sinnar / सिन्नर",
    "Igatpuri / इगतपुरी",
    "Dindori / दिंडोरी",
    "Yeola / येवला",
  ],
  "Nagpur": ["Nagpur / नागपूर", "Hingna / हिंगणा", "Kamptee / कामठी", "Saoner / सावनेर", "Ramtek / रामटेक"],
};
/** Villages relevant for the default (Pune) flow, grouped by taluka. */
const PUNE_VILLAGES = {
  "Haveli / हवेली": [
    "Baner / बाणेर",
    "Bavdhan / बावधन",
    "Undri / उंद्री",
    "Kharadi / खराडी",
    "Hadapsar / हडपसर",
    "Wadgaon Sheri / वडगाव शेरी",
    "Aundh / औंध",
    "Koregaon Park / कोरेगाव पार्क",
    "Viman Nagar / विमान नगर",
    "Dhanori / धानोरी",
    "Lohegaon / लोहगाव",
    "Kesnand / केसनंद",
  ],
  "Pune City / पुणे शहर": [
    "Shivajinagar / शिवाजीनगर",
    "Sadashiv Peth / सदाशिव पेठ",
    "Kasba Peth / कसबा पेठ",
    "Rasta Peth / रास्ता पेठ",
    "Deccan / डेक्कन",
    "Camp / कॅम्प",
  ],
  "Mulshi / मुळशी": [
    "Paud / पौड",
    "Mulshi / मुळशी",
    "Hinjewadi / हिंजवडी",
    "Trimbakeshwar Phata / त्र्यंबकेश्वर फाटा",
  ],
  "Maval / मावळ": [
    "Vadgaon / वडगाव",
    "Talawade / तळवडे",
    "Dehu Road / देहू रोड",
    "Morwadi / मोरवाडी",
  ],
  "Bhor / भोर": ["Bhor / भोर", "Nasarapur / नसरापूर", "Kusgaon / कुसगाव"],
  "Velhe / वेल्हे": ["Velhe / वेल्हे", "Tardhav / तारढव", "Ghanpuri / घणपुरी"],
  "Purandar / पुरंदर": ["Saswad / सासवड", "Jejuri / जेजुरी", "Morgaon / मोरगाव"],
  "Baramati / बारामती": ["Baramati / बारामती", "Malegaon / मालेगाव", "Koregaon / कोरेगाव"],
  "Indapur / इंदापूर": ["Indapur / इंदापूर", "Nira / निरा", "Velapur / वेलापूर"],
  "Daund / दौंड": ["Daund / दौंड", "Patas / पाटस", "Koregaon Bhima / कोरेगाव भीमा"],
  "Shirur / शिरूर": ["Shirur / शिरूर", "Talegaon Dhamdhere / तळेगाव धामधरे", "Gangapur / गंगापूर"],
  "Junnar / जुन्नर": ["Junnar / जुन्नर", "Ozar / ओझर", "Otur / ओतूर"],
  "Ambegaon / आंबेगाव": ["Ghodegaon / घोडेगाव", "Ambegaon / आंबेगाव", "Kotul / कोतूळ"],
  "Khed / खेड": ["Rajgurunagar / राजगुरूनगर", "Chakan / चाकण", "Alandi / आळंदी"],
};

/**
 * Villages grouped by district. Each entry is either:
 *   - an object keyed by taluka label (e.g. Pune), or
 *   - a flat array of village labels.
 * A curated subset ships; the form also offers an "Other (type it)" option so
 * valid villages that aren't listed yet never block saving.
 */
export const MAHARASHTRA_VILLAGES = {
  "Pune": PUNE_VILLAGES,
  "Thane": [
    "Thane / ठाणे",
    "Kalyan / कल्याण",
    "Dombivli / डोंबिवली",
    "Ulhasnagar / उल्हासनगर",
    "Vasai / वसई",
    "Bhiwandi / भिवंडी",
    "Badlapur / बदलापूर",
    "Murbad / मुरबाड",
  ],
  "Nashik": [
    "Nashik / नाशिक",
    "Trimbakeshwar / त्र्यंबकेश्वर",
    "Igatpuri / इगतपुरी",
    "Niphad / निफाड",
    "Sinnar / सिन्नर",
    "Malegaon / मालेगाव",
    "Yeola / येवला",
  ],
  "Nagpur": [
    "Nagpur / नागपूर",
    "Kamptee / कामठी",
    "Hingna / हिंगणा",
    "Saoner / सावनेर",
    "Ramtek / रामटेक",
  ],
};

/** Unique village list for a District + Taluka; falls back to the whole
 * district, or [] when nothing is configured. */
export function getVillagesFor(district, taluka) {
  const entry = MAHARASHTRA_VILLAGES[district];
  if (!entry) return [];
  if (Array.isArray(entry)) return entry;
  const byTaluka = entry[taluka];
  if (byTaluka && byTaluka.length) return byTaluka;
  const seen = new Set();
  const all = [];
  for (const list of Object.values(entry)) {
    for (const v of list) {
      if (!seen.has(v)) {
        seen.add(v);
        all.push(v);
      }
    }
  }
  return all;
}

export function getTalukasFor(district) {
  return MAHARASHTRA_TALUKAS[district] || [];
}
export const ATTRIBUTE_TYPES = [
  "Survey Number",
  "C.T.S. Number",
  "Plot Number",
  "Gat Number",
  "Hissa Number",
  "Milkat Number",
];

export const AREA_UNITS = [
  "Square Foot",
  "Square Meter / चौ.मीटर",
  "Acre / एकर",
  "Hectare / हेक्टर",
  "Guntha / गुंठा",
];

export const HADD_TYPES = [
  "Corporation / महानगरपालिका",
  "Municipal Council / नगरपरिषद",
  "Nagarpanchayat / नगरपंचायत",
  "Cantonment / छावणी परिषद",
  "Grampanchayat / ग्रामपंचायत",
];

export const HADD_NAMES = [
  "Pune M.N.Pa. / पुणे म.न.पा.",
  "PCMC / पिंपरी-चिंचवड म.न.पा.",
  "Thane M.N.Pa. / ठाणे म.न.पा.",
  "Nashik M.N.Pa. / नाशिक म.न.पा.",
  "Nagpur M.N.Pa. / नागपूर म.न.पा.",
];

export const ELECTRICITY_BOARDS = [
  "MSEDCL",
  "Tata Power",
  "Adani Electricity Mumbai",
  "BEST Undertaking",
  "Torrent Power",
];

export const PROPERTY_TYPES = [
  "Flat / सदनिका",
  "Plot / भूखंड",
  "House / घर",
  "Shop / दुकान",
  "Office / कार्यालय",
  "Godown / गोदाम",
  "Industrial / औद्योगिक",
  "Agricultural / शेतजमीन",
  "Open Land / मोकळी जागा",
];