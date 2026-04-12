DELETE FROM tbl_recruit_area_code
WHERE recruit_area_id = 40001 OR code_id = 50001;

DELETE FROM tbl_recruit_area
WHERE id = 40001;

DELETE FROM tbl_recruitment
WHERE id = 30001;

DELETE FROM tbl_company
WHERE company_id = 20001;

DELETE FROM tbl_student
WHERE student_id = 10001;

DELETE FROM tbl_user
WHERE id = 10001 OR account_id = 'harness.student.01';

DELETE FROM tbl_code
WHERE code = 50001 OR keyword = 'HarnessBackend';

INSERT INTO tbl_user (
    id,
    created_at,
    account_id,
    password,
    authority,
    token
) VALUES (
    10001,
    NOW(),
    'harness.student.01',
    '$2a$10$fK42cS5/08WVME6T9J7jmuCa9081s/XKqWQ18tWY4ERmjSG4V1f0a',
    'STUDENT',
    NULL
);

INSERT INTO tbl_student (
    student_id,
    name,
    grade,
    class_room,
    number,
    gender,
    department,
    profile_image_url,
    entrance_year
) VALUES (
    10001,
    'HStudent',
    2,
    1,
    1,
    'MAN',
    'SOFTWARE_DEVELOP',
    'EXTENSION_FILE/default_image.png',
    YEAR(CURDATE()) - 1
);

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
    20001,
    'Harness Company',
    '1234567890',
    'PARTICIPATING',
    1,
    'HRep',
    '2020-01-01',
    12000,
    25,
    'harness-company@example.com',
    'Public-safe synthetic company for harness verification.',
    'LOGO_IMAGE/companydefault.png',
    NULL,
    'Software',
    'HarnessPlatform',
    NULL,
    'Daejeon Yuseong-gu 101',
    'Suite 401',
    '34141',
    'HMgr',
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
    30001,
    NOW(),
    YEAR(CURDATE()),
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
    20001,
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
    40001,
    2,
    'Backend development for harness recruitment listing verification',
    'Docker and API testing experience',
    30001
);

INSERT INTO tbl_code (
    code,
    type,
    job_type,
    keyword,
    is_public,
    parent_code_id
) VALUES (
    50001,
    'JOB',
    'WEB',
    'HarnessBackend',
    1,
    NULL
);

INSERT INTO tbl_recruit_area_code (
    type,
    recruit_area_id,
    code_id
) VALUES (
    'JOB',
    40001,
    50001
);
