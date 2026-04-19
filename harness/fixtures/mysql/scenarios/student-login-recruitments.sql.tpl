DELETE FROM tbl_recruit_area_code
WHERE recruit_area_id = {{RECRUIT_AREA_ID}} OR code_id = {{CODE_ID}};

DELETE FROM tbl_recruit_area
WHERE id = {{RECRUIT_AREA_ID}};

DELETE FROM tbl_recruitment
WHERE id = {{RECRUITMENT_ID}};

DELETE FROM tbl_company
WHERE company_id = {{COMPANY_ID}};

DELETE FROM tbl_code
WHERE code = {{CODE_ID}} OR keyword = '{{CODE_KEYWORD}}';

INSERT INTO tbl_company (
    company_id,
    name,
    biz_no,
    type,
    is_mou,
    representative,
    founded_at,
    take,
    workers_count,
    email,
    company_introduce,
    company_logo_url,
    biz_registration_url,
    business_area,
    service_name,
    attachment_urls,
    main_address,
    main_address_detail,
    main_zip_code,
    manager_name,
    manager_phone_no,
    headquarter,
    representative_phone_no
) VALUES (
    {{COMPANY_ID}},
    '{{RECRUITMENT_COMPANY_NAME}}',
    '{{COMPANY_BIZ_NO}}',
    'PARTICIPATING',
    1,
    'HarnessRep',
    '2020-01-01',
    12000,
    25,
    'harness-company@example.com',
    'Synthetic company for harness recruitment verification.',
    'LOGO_IMAGE/companydefault.png',
    NULL,
    'Software',
    'HarnessPlatform',
    NULL,
    'Daejeon Yuseong-gu 101',
    'Suite 401',
    '34141',
    'HarnessMgr',
    '01087654321',
    1,
    '01012345678'
);

INSERT INTO tbl_recruitment (
    id,
    created_at,
    recruit_year,
    status,
    required_licenses,
    additional_qualifications,
    working_hours,
    flexible_working,
    benefits,
    military_support,
    hiring_progress,
    submit_document,
    etc,
    personal_contact,
    winter_intern,
    company_id,
    start_date,
    finish_date,
    train_pay,
    pay,
    hire_convertible,
    integration_plan
) VALUES (
    {{RECRUITMENT_ID}},
    NOW(),
    {{CURRENT_YEAR}},
    'RECRUITING',
    'EngineerCert',
    'Spring Boot,MySQL basics',
    '09:00~18:00',
    0,
    'Meal support,device support',
    0,
    'DOCUMENT,TECH_INTERVIEW,FINAL_INTERVIEW',
    'Resume',
    'Synthetic recruitment for harness.',
    0,
    0,
    {{COMPANY_ID}},
    CURDATE() - INTERVAL 3 DAY,
    CURDATE() + INTERVAL 30 DAY,
    2500000,
    'Negotiable',
    1,
    0
);

INSERT INTO tbl_recruit_area (
    id,
    hired_count,
    major_task,
    preferential_treatment,
    recruitment_id
) VALUES (
    {{RECRUIT_AREA_ID}},
    2,
    'Backend development for harness recruitment listing verification',
    'Docker and API testing experience',
    {{RECRUITMENT_ID}}
);

INSERT INTO tbl_code (
    code,
    type,
    job_type,
    keyword,
    is_public,
    parent_code_id
) VALUES (
    {{CODE_ID}},
    'JOB',
    'WEB',
    '{{CODE_KEYWORD}}',
    1,
    NULL
);

INSERT INTO tbl_recruit_area_code (
    type,
    recruit_area_id,
    code_id
) VALUES (
    'JOB',
    {{RECRUIT_AREA_ID}},
    {{CODE_ID}}
);
