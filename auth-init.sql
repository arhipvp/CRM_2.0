-- Создание таблиц Auth
CREATE TABLE auth.roles (
    id UUID NOT NULL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    description VARCHAR(255)
);

CREATE TABLE auth.users (
    id UUID NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth.user_roles (
    id BIGSERIAL NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES auth.roles(id) ON DELETE CASCADE
);

-- Таблица для Liquibase версионирования
CREATE TABLE auth.databasechangelog (
    ID VARCHAR(255) NOT NULL,
    AUTHOR VARCHAR(255) NOT NULL,
    FILENAME VARCHAR(255) NOT NULL,
    DATEEXECUTED TIMESTAMP NOT NULL,
    ORDEREXECUTED INTEGER NOT NULL,
    EXECTYPE VARCHAR(10) NOT NULL,
    MD5SUM VARCHAR(35),
    DESCRIPTION VARCHAR(255),
    COMMENTS VARCHAR(255),
    TAG VARCHAR(255),
    LIQUIBASE VARCHAR(20),
    CONTEXTS VARCHAR(255),
    LABELS VARCHAR(255),
    DEPLOYMENT_ID VARCHAR(10),
    PRIMARY KEY (ID, AUTHOR, FILENAME)
);

CREATE TABLE auth.databasechangeloglock (
    ID INTEGER NOT NULL PRIMARY KEY,
    LOCKED BOOLEAN NOT NULL,
    LOCKGRANTED TIMESTAMP,
    LOCKEDBY VARCHAR(255)
);

-- Вставляем запись в databasechangelog для Liquibase
INSERT INTO auth.databasechangelog (ID, AUTHOR, FILENAME, DATEEXECUTED, ORDEREXECUTED, EXECTYPE, DESCRIPTION, LIQUIBASE)
VALUES ('0001-init-auth-tables', 'crm-team', 'db/changelog/changesets/0001-init-auth-tables.yaml', NOW(), 1, 'EXECUTED', 'Initial auth tables', '4.0.0');

-- Таблица блокировки для Liquibase
INSERT INTO auth.databasechangeloglock (ID, LOCKED) VALUES (1, false);
