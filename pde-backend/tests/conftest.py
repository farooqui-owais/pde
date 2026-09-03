import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Force sqlite for isolated in-memory unit tests
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["DEBUG"] = "True"
os.environ["SECRET_KEY"] = "test-secret-key-32-chars-long-enough!"

from app.database import Base, get_db
from app.main import app
from app import models, models_scheme
from app.security import hash_password, create_access_token

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    user = models.User(
        username="testcitizen",
        first_name="Rajesh",
        last_name="Sharma",
        email="rajesh@example.com",
        mobile_number="9876543210",
        pin_code="411001",
        hashed_password=hash_password("Pass@1234"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(client, test_user):
    csrf_res = client.get("/api/auth/csrf-token")
    csrf_token = csrf_res.json().get("csrf_token") if csrf_res.status_code == 200 else ""
    token = create_access_token(data={"sub": str(test_user.id)})
    return {
        "Authorization": f"Bearer {token}",
        "X-CSRF-Token": csrf_token,
    }
