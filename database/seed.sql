INSERT INTO roles (name) VALUES
('ADMIN'),
('OPERATOR');

INSERT INTO users (username, email, hashed_password, role_id)
VALUES (
    'admin',
    'admin@c2.local',
    '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7nZ9YjRzCQXDpUe1koRaSPo6e7iT730', -- password: password
    1
);

INSERT INTO assets (name, type, location)
VALUES (
    'Radar Station Alpha',
    'RADAR',
    ST_GeogFromText('SRID=4326;POINT(77.1025 28.7041)')
);