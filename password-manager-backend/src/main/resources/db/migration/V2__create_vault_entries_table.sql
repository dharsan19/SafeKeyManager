CREATE TABLE vault_entries (
    id                 BIGSERIAL    PRIMARY KEY,
    user_id            BIGINT       NOT NULL,
    site_name          VARCHAR(255) NOT NULL,
    site_url           VARCHAR(500),
    username_encrypted TEXT,
    password_encrypted TEXT         NOT NULL,
    notes_encrypted    TEXT,
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vault_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_vault_user_id   ON vault_entries(user_id);
CREATE INDEX idx_vault_site_name ON vault_entries(user_id, site_name);
