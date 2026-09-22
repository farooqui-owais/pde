"""Tests for the edit/select behaviour on Property, Party and Identification
detail pages: every field the frontend form shows must persist on POST and
actually change on PUT (previously salutation / occupation / gender /
date_of_birth, boundaries and the attribute-type list were dropped)."""
import pytest


def _make_entry(client, auth_headers):
    token_payload = {
        "language": "Marathi",
        "district_id": 1,
        "office_id": 1,
        "presenter_name": "Rajesh Sharma",
    }
    res = client.post("/api/tokens", json=token_payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    token_id = res.json()["id"]

    entry_payload = {
        "token_id": token_id,
        "article_type_id": 1,
        "document_title": "Sale Deed / खरेदीखत",
        "market_value": 5000000.0,
        "consideration_amount": 5500000.0,
        "number_of_pages": 12,
    }
    res = client.post("/api/documents", json=entry_payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_property_update_includes_boundaries_and_attributes(client, auth_headers):
    entry_id = _make_entry(client, auth_headers)

    create_payload = {
        "district": "Pune",
        "village_name": "Baner",
        "urban_rural": "Urban",
        "hadd_type": "Municipal Corporation",
        "hadd_name": "PMC",
        "taluka": "Haveli",
        "attributes": [{"type": "Survey Number", "value": "123/1"}],
        "area": 850.0,
        "area_unit": "Square Foot",
        "property_type": "Flat",
    }
    res = client.post(f"/api/documents/{entry_id}/properties", json=create_payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    prop_id = res.json()["id"]

    update_payload = {
        **create_payload,
        "attributes": [{"type": "C.T.S. Number", "value": "456/2"}],
        "boundaries_en": "North: Road, South: Garden",
        "boundaries_mr": "उत्तर: रस्ता, दक्षिण: बाग",
        "non_cultivable_area": 12.5,
        "electricity_board": "Tata Power",
        "consumer_number": "111122223333",
    }
    res = client.put(
        f"/api/documents/{entry_id}/properties/{prop_id}",
        json=update_payload,
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    updated = res.json()
    assert updated["attributes"] == [{"type": "C.T.S. Number", "value": "456/2"}]
    assert updated["boundaries_en"] == "North: Road, South: Garden"
    assert updated["boundaries_mr"] == "उत्तर: रस्ता, दक्षिण: बाग"
    assert float(updated["non_cultivable_area"]) == 12.5
    assert updated["electricity_board"] == "Tata Power"
    assert updated["consumer_number"] == "111122223333"

    # The refreshed list (what the Select link reads back) must show it too.
    res = client.get(f"/api/documents/{entry_id}/properties", headers=auth_headers)
    assert res.status_code == 200
    row = next(p for p in res.json() if p["id"] == prop_id)
    assert row["attributes"] == [{"type": "C.T.S. Number", "value": "456/2"}]
    assert row["boundaries_en"] == "North: Road, South: Garden"
    assert row["electricity_board"] == "Tata Power"


def test_party_update_includes_salutation_occupation_gender_dob(client, auth_headers):
    entry_id = _make_entry(client, auth_headers)

    create_payload = {
        "party_type": "Seller/Vendor",
        "first_name_en": "Sunil",
        "surname_en": "Kadam",
        "age": 50,
        "pan_number": "ABCDE1234F",
        "mobile_number": "9822334455",
    }
    res = client.post(f"/api/documents/{entry_id}/parties", json=create_payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    party_id = res.json()["id"]

    update_payload = {
        **create_payload,
        "salutation": "Mr.",
        "occupation": "Business",
        "gender": "Male / पुरुष",
        "date_of_birth": "1975-04-21",
        "execution_by": "POA",
        "uid_consent_aadhaar": True,
    }
    res = client.put(
        f"/api/documents/{entry_id}/parties/{party_id}",
        json=update_payload,
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    updated = res.json()
    assert updated["salutation"] == "Mr."
    assert updated["occupation"] == "Business"
    assert updated["gender"] == "Male / पुरुष"
    assert updated["date_of_birth"] == "1975-04-21"
    assert updated["execution_by"] == "POA"
    assert updated["uid_consent_aadhaar"] is True

    res = client.get(f"/api/documents/{entry_id}/parties", headers=auth_headers)
    row = next(p for p in res.json() if p["id"] == party_id)
    assert row["salutation"] == "Mr."
    assert row["date_of_birth"] == "1975-04-21"
    assert row["gender"] == "Male / पुरुष"


def test_identification_update_includes_date_of_birth(client, auth_headers):
    entry_id = _make_entry(client, auth_headers)

    create_payload = {
        "first_name_en": "Vikas",
        "surname_en": "Shinde",
        "age": 40,
        "address_en": "Baner, Pune",
        "identification_proof": "PAN Card",
        "proof_number": "CDEFG3456H",
    }
    res = client.post(f"/api/documents/{entry_id}/identifications", json=create_payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    ident_id = res.json()["id"]

    update_payload = {**create_payload, "date_of_birth": "1985-02-11"}
    res = client.put(
        f"/api/documents/{entry_id}/identifications/{ident_id}",
        json=update_payload,
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["date_of_birth"] == "1985-02-11"

    res = client.get(f"/api/documents/{entry_id}/identifications", headers=auth_headers)
    row = next(i for i in res.json() if i["id"] == ident_id)
    assert row["date_of_birth"] == "1985-02-11"


def test_property_update_returns_404_for_unknown_id(client, auth_headers):
    entry_id = _make_entry(client, auth_headers)
    res = client.put(
        f"/api/documents/{entry_id}/properties/00000000-0000-0000-0000-000000000000",
        json={"district": "Pune", "village_name": "Baner"},
        headers=auth_headers,
    )
    assert res.status_code == 404
