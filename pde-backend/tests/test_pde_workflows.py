import pytest


def test_pde_full_workflow(client, auth_headers, test_user):
    # 1. Create a Token
    token_payload = {
        "language": "Marathi",
        "district_id": 1,
        "office_id": 1,
        "presenter_name": "Rajesh Sharma",
    }
    res = client.post("/api/tokens", json=token_payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    token_data = res.json()
    token_id = token_data["id"]
    assert len(token_data["token_number"]) == 11

    # 2. Presentation Step 1 (Create Document Entry)
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
    entry_data = res.json()
    entry_id = entry_data["id"]
    assert entry_data["stamp_duty"] is not None

    # Stamp duty calculation verification
    calc_res = client.post(
        "/api/documents/calculate-stamp-duty",
        json={"market_value": 5000000.0, "consideration_amount": 5500000.0},
        headers=auth_headers,
    )
    assert calc_res.status_code == 200
    assert float(calc_res.json()["stamp_duty"]) == 330000.0

    # 3. Add Multiple Properties
    prop1_payload = {
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
        "building_name_en": "Green Vista",
        "road_en": "Baner Road",
    }
    res = client.post(f"/api/documents/{entry_id}/properties", json=prop1_payload, headers=auth_headers)
    assert res.status_code == 201
    prop1_id = res.json()["id"]

    prop2_payload = {
        "district": "Pune",
        "village_name": "Baner",
        "urban_rural": "Urban",
        "hadd_type": "Municipal Corporation",
        "hadd_name": "PMC",
        "taluka": "Haveli",
        "attributes": [{"type": "Plot Number", "value": "P-45"}],
        "area": 120.0,
        "area_unit": "Square Foot",
        "property_type": "Parking",
    }
    res = client.post(f"/api/documents/{entry_id}/properties", json=prop2_payload, headers=auth_headers)
    assert res.status_code == 201

    # Verify multiple properties listed
    res = client.get(f"/api/documents/{entry_id}/properties", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 2

    # 4. Add Multiple Parties
    seller_payload = {
        "party_type": "Seller/Vendor",
        "first_name_en": "Sunil",
        "surname_en": "Kadam",
        "age": 50,
        "is_presentor": True,
        "pan_number": "ABCDE1234F",
        "mobile_number": "9822334455",
        "district_name": "Pune",
    }
    res = client.post(f"/api/documents/{entry_id}/parties", json=seller_payload, headers=auth_headers)
    assert res.status_code == 201

    purchaser_payload = {
        "party_type": "Purchaser",
        "first_name_en": "Amit",
        "surname_en": "Patil",
        "age": 35,
        "is_stamp_purchaser": True,
        "pan_number": "BCDEF2345G",
        "mobile_number": "9811223344",
        "district_name": "Pune",
    }
    res = client.post(f"/api/documents/{entry_id}/parties", json=purchaser_payload, headers=auth_headers)
    assert res.status_code == 201

    # Verify multiple parties listed
    res = client.get(f"/api/documents/{entry_id}/parties", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 2

    # 5. Add Identifiers / Witnesses
    ident1_payload = {
        "first_name_en": "Vikas",
        "surname_en": "Shinde",
        "age": 40,
        "address_en": "Baner, Pune",
        "identification_proof": "PAN Card",
        "proof_number": "CDEFG3456H",
    }
    res = client.post(f"/api/documents/{entry_id}/identifications", json=ident1_payload, headers=auth_headers)
    assert res.status_code == 201

    ident2_payload = {
        "first_name_en": "Rahul",
        "surname_en": "Joshi",
        "age": 45,
        "address_en": "Aundh, Pune",
        "identification_proof": "Aadhaar Card",
        "proof_number": "123456789012",
    }
    res = client.post(f"/api/documents/{entry_id}/identifications", json=ident2_payload, headers=auth_headers)
    assert res.status_code == 201

    # 6. Stamp Payment details
    payment_payload = {
        "document_entry_id": entry_id,
        "paid_by": "e-Challan",
        "amount": 330000.0,
        "serial_no": "MH-ECH-987654",
    }
    res = client.post("/api/stamp/payments", json=payment_payload, headers=auth_headers)
    assert res.status_code == 201

    # 7. Generate Public Data Entry Report
    res = client.get(f"/api/documents/{entry_id}/report", headers=auth_headers)
    assert res.status_code == 200
    report_data = res.json()
    assert report_data["token_number"] == token_data["token_number"]
    assert float(report_data["consideration_amount"]) == 5500000.0
    assert len(report_data["executants"]) >= 1
    assert len(report_data["witnesses"]) == 2

    # 8. Complete Entry & Get Concurrent Registration Offices
    res = client.post(f"/api/documents/{entry_id}/complete", headers=auth_headers)
    assert res.status_code == 200
    confirm_data = res.json()
    assert confirm_data["status"] == "SUBMITTED"
    assert confirm_data["token_number"] == token_data["token_number"]
