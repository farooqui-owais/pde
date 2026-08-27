"""Seed reference data: districts, offices, article types.
Run with: python -m app.seed
"""
from .database import SessionLocal, Base, engine
from . import models

Base.metadata.create_all(bind=engine)

DISTRICTS = ["Pune", "Mumbai City", "Mumbai Suburban", "Nashik", "Nagpur", "Thane"]
OFFICES = {
    "Pune": ["Joint S.R. Haveli 1", "Joint S.R. Haveli 14", "Joint S.R. Pune City 3"],
    "Mumbai City": ["S.R. Mumbai City 1", "S.R. Mumbai City 2"],
}
ARTICLE_TYPES = [
    ("25", "Conveyance", False),
    ("34", "Gift", False),
    ("36", "Lease", True),
    ("36-A", "Leave and Licenses", True),
    ("40", "Mortgage Deed", False),
    ("46", "Partition", False),
    ("47", "Partnership", False),
    ("48", "Power of Attorney", False),
    ("51", "Reconveyance of Mortgaged Property", False),
    ("52", "Release", False),
    ("54", "Security Bond or Mortgage Deed", False),
    ("55", "Settlement", False),
    ("58", "Surrender of Lease", False),
    ("60", "Transfer of Lease", False),
    ("63", "Will", False),
    ("65", "Correction Deed", False),
    ("66", "Notice of Lease Pendency", False),
]

# Marathi document-title options shown for Conveyance (25), matching the
# reference "Document Title" dropdown.
CONVEYANCE_TITLES = [
    "\u0905\u092d\u093f\u0939\u0938\u094d\u0924\u093e\u0902\u0924\u0930\u0923\u092a\u0924\u094d\u0930",  # अभिहस्तांतरणपत्र
    "\u0916\u0930\u0947\u0926\u0940\u0916\u0924",  # खरेदीखत
    "\u0916\u0941\u0937\u0916\u0930\u0947\u0926\u0940\u0916\u0924",  # खुषखरेदीखत
    "\u092b\u0930\u094b\u0916\u0924\u0916\u0930\u0947\u0926\u0940\u0916\u0924",  # फरोख्तखरेदीखत
    "\u0935\u093f\u0915\u094d\u0930\u0940\u092a\u0924\u094d\u0930",  # विक्रीपत्र
    "\u0935\u093f\u0915\u094d\u0930\u0940 \u0915\u0930\u093e\u0930\u0928\u093e\u092e\u093e",  # विक्री करारनामा
    "\u0938\u093e\u0920\u0947\u0916\u0924",  # साठेखत
    "\u0905\u0945\u0917\u094d\u0930\u0940\u092e\u0947\u0902\u091f \u091f\u0942 \u0938\u0947\u0932",  # अॅग्रीमेंट टू सेल
    "\u0938\u0947\u0932 \u0921\u0940\u0921",  # सेल डीड
    "\u0915\u0928\u094d\u0935\u094d\u0939\u0947\u0928\u094d\u0938 \u0921\u0940\u0921",  # कन्व्हेन्स डीड
    "\u091f\u094d\u0930\u093e\u0928\u094d\u0938\u092b\u0930 \u0921\u0940\u0921",  # ट्रान्सफर डीड
    "\u0939\u0938\u094d\u0924\u093e\u0902\u0924\u0930\u0923\u092a\u0924\u094d\u0930",  # हस्तांतरणपत्र
    "\u0924\u092c\u0926\u0940\u0932\u092a\u0924\u094d\u0930",  # तबदीलपत्र
    "\u0924\u092c\u0926\u0940\u0932\u0940\u091a\u093e \u0915\u0930\u093e\u0930\u0928\u093e\u092e\u093e",  # तबदीलीचा करारनामा
]


def run():
    db = SessionLocal()
    try:
        district_map = {}
        for name in DISTRICTS:
            existing = db.query(models.District).filter_by(name=name).first()
            if not existing:
                existing = models.District(name=name)
                db.add(existing)
                db.flush()
            district_map[name] = existing

        for dname, offices in OFFICES.items():
            for oname in offices:
                exists = db.query(models.RegistrationOffice).filter_by(name=oname).first()
                if not exists:
                    db.add(models.RegistrationOffice(name=oname, district_id=district_map[dname].id))

        conveyance = None
        for code, name, has_rent_terms in ARTICLE_TYPES:
            exists = db.query(models.ArticleType).filter_by(code=code, name=name).first()
            if not exists:
                exists = models.ArticleType(code=code, name=name, has_rent_terms=has_rent_terms)
                db.add(exists)
                db.flush()
            if code == "25":
                conveyance = exists

        if conveyance:
            for label in CONVEYANCE_TITLES:
                exists = db.query(models.DocumentTitle).filter_by(
                    article_type_id=conveyance.id, label_marathi=label
                ).first()
                if not exists:
                    db.add(models.DocumentTitle(article_type_id=conveyance.id, label_marathi=label))

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
