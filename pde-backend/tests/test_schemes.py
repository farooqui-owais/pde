import io
import pytest


def test_scheme_full_workflow(client, auth_headers):
    # 1. Create a Project
    project_payload = {
        "project_name": "Godrej Horizon",
        "developed_by": "Godrej Properties",
        "district": "Pune",
        "taluka": "Haveli",
        "village": "Undri",
        "location": "Near Corinthian Club",
    }
    res = client.post("/api/v1/projects", json=project_payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    project_data = res.json()
    project_id = project_data["id"]
    assert project_data["project_name"] == "Godrej Horizon"

    # 2. Create a Scheme
    scheme_payload = {
        "project_id": project_id,
        "scheme_name": "Horizon Phase 1 - Tower A",
        "article": "Conveyance",
        "document_title": "Sale Deed / खरेदीखत",
        "maha_rera_number": "P52100024567",
        "project_area": 85000.0,
    }
    res = client.post("/api/v1/schemes", json=scheme_payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    scheme_data = res.json()
    scheme_id = scheme_data["id"]
    assert scheme_data["scheme_name"] == "Horizon Phase 1 - Tower A"
    assert scheme_data["status"] == "draft"

    # 3. List Schemes
    res = client.get("/api/v1/schemes?search=Horizon", headers=auth_headers)
    assert res.status_code == 200
    list_data = res.json()
    assert list_data["total"] >= 1
    assert any(s["id"] == scheme_id for s in list_data["items"])

    # 4. Check Submission Readiness (should fail because prerequisites are missing)
    res = client.get(f"/api/v1/schemes/{scheme_id}/submission-check", headers=auth_headers)
    assert res.status_code == 200
    readiness = res.json()
    assert readiness["can_submit"] is False
    assert len(readiness["errors"]) > 0

    # 5. Step 1: Add Seller Party
    seller_payload = {
        "party_category": "Company",
        "party_name": "Godrej Projects Development Ltd",
        "company_name": "Godrej Projects Development Ltd",
        "registration_number": "U45200MH2008PLC181234",
        "pan_number": "AAACG1234F",
        "mobile_number": "9822001122",
        "email": "contact@godrejprojects.com",
        "state": "Maharashtra",
        "district": "Pune",
        "taluka": "Haveli",
        "village": "Undri",
    }
    res = client.post(f"/api/v1/schemes/{scheme_id}/seller-parties", json=seller_payload, headers=auth_headers)
    assert res.status_code == 201
    seller_data = res.json()
    assert seller_data["party_name"] == "Godrej Projects Development Ltd"

    # 6. Step 2: Add Scheme Identifier
    identifier_payload = {
        "identifier_type": "Identifier / Witness",
        "name": "Sunil V. Deshmukh",
        "age": 42,
        "gender": "Male",
        "mobile_number": "9890123456",
        "email": "sunil.deshmukh@example.com",
        "pan_number": "BCDEF5678G",
        "address": "Flat 101, Shivneri Heights, Pune",
        "district": "Pune",
        "taluka": "Haveli",
    }
    res = client.post(f"/api/v1/schemes/{scheme_id}/identifier", json=identifier_payload, headers=auth_headers)
    assert res.status_code == 201
    identifier_data = res.json()
    assert identifier_data["name"] == "Sunil V. Deshmukh"

    # 7. Step 3: Upload mandatory Scheme Documents
    pdf_content = b"%PDF-1.4 simulated pdf document for testing purposes"
    mandatory_types = [
        "7/12 Extract / Index II",
        "MahaRERA Certificate",
        "Approved Layout / Sanction Plan",
        "Title & Search Certificate",
    ]
    for idx, doc_type in enumerate(mandatory_types):
        files = {
            "file": (f"mandatory_{idx}.pdf", io.BytesIO(pdf_content), "application/pdf"),
        }
        data = {"scheme_id": scheme_id, "document_type": doc_type}
        res = client.post(f"/api/v1/schemes/{scheme_id}/documents", data=data, files=files, headers=auth_headers)
        assert res.status_code == 201, res.text
        assert res.json()["document_type"] == doc_type

    # Test non-PDF rejection
    txt_files = {
        "file": ("malicious.exe", io.BytesIO(b"not a pdf"), "application/octet-stream"),
    }
    data = {"scheme_id": scheme_id, "document_type": "Other Supporting Document"}
    res_bad = client.post(f"/api/v1/schemes/{scheme_id}/documents", data=data, files=txt_files, headers=auth_headers)
    assert res_bad.status_code == 400

    # 8. Step 4: Create Deed Template & Preview
    template_payload = {
        "template_name": "Standard Sale Agreement",
        "template_code": "TMPL-HORIZON-01",
        "template_content": "This Agreement for Flat {{property.flat_number}} in {{scheme.scheme_name}} by {{seller.name}}.",
    }
    res = client.post(f"/api/v1/schemes/{scheme_id}/templates", json=template_payload, headers=auth_headers)
    assert res.status_code == 201
    tmpl_data = res.json()
    template_id = tmpl_data["id"]
    assert tmpl_data["template_name"] == "Standard Sale Agreement"

    # Test Template Preview
    preview_res = client.post(
        f"/api/v1/templates/{template_id}/preview",
        json={"template_content": "Agreement between {{seller.name}} and {{project.project_name}}"},
        headers=auth_headers,
    )
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert "Godrej" in preview_data["rendered_html"]

    # 9. Step 5: Check Readiness & Submit Scheme
    res = client.get(f"/api/v1/schemes/{scheme_id}/submission-check", headers=auth_headers)
    assert res.status_code == 200
    readiness = res.json()
    assert readiness["can_submit"] is True

    # Submit
    submit_res = client.post(f"/api/v1/schemes/{scheme_id}/submit", headers=auth_headers)
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "submitted"

    # 10. Modify Scheme
    modify_res = client.post(f"/api/v1/schemes/{scheme_id}/modify", headers=auth_headers)
    assert modify_res.status_code == 200
    assert modify_res.json()["status"] == "draft"
