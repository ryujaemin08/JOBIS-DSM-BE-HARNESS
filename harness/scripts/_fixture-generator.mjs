function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function sqlString(value) {
  return `'${escapeSqlString(value)}'`;
}

function sqlNullable(value) {
  if (value == null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return sqlString(value);
}

function limit(value, maxLength) {
  return String(value ?? "").slice(0, maxLength);
}

function quoteIdentifier(identifier) {
  return identifier.replace(/[^a-zA-Z0-9_]/g, "");
}

function findExample(fields = [], name, fallback = "") {
  return fields.find((field) => field.name === name)?.example ?? fallback;
}

function getRequestFieldMap(fields = []) {
  return Object.fromEntries(fields.map((field) => [field.name, field.example ?? null]));
}

function datasetScaleForTask(task = "", requestSpec = {}) {
  const explicit = Number(requestSpec.harness?.seed?.dataset_scale ?? requestSpec.harness?.dataset_scale);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const lowerTask = String(task).toLowerCase();
  if (/latency|performance|slow|optimi[sz]e|400ms|p95|throughput/.test(lowerTask)) {
    return 40;
  }
  return 6;
}

function inferFamily(requestSpec = {}) {
  const path = String(requestSpec.path ?? "").toLowerCase();
  const summary = String(requestSpec.summary ?? "").toLowerCase();
  const purpose = String(requestSpec.purpose ?? "").toLowerCase();
  const text = `${path} ${summary} ${purpose}`;

  if (text.includes("/interviews") || text.includes("interview")) return "interviews";
  if (text.includes("/recruitments") || text.includes("recruitment")) return "recruitments";
  if (text.includes("/companies") || text.includes("company")) return "companies";
  if (text.includes("/notices") || text.includes("notice")) return "notices";
  if (text.includes("/banners") || text.includes("banner")) return "banners";
  if (text.includes("/bugs") || text.includes("bug")) return "bugs";
  return "generic";
}

function buildBaseIdentitySql(context) {
  return `
DELETE FROM tbl_interview
WHERE id IN (${context.INTERVIEW_ID_1}, ${context.INTERVIEW_ID_2}, ${context.INTERVIEW_ID_3}, ${context.INTERVIEW_ID_4});

DELETE FROM tbl_document_number
WHERE id = ${context.DOCUMENT_NUMBER_ID};

DELETE FROM tbl_teacher
WHERE teacher_id = ${context.TEACHER_ID};

DELETE FROM tbl_student
WHERE student_id IN (${context.STUDENT_ID}, ${context.SECOND_STUDENT_ID});

DELETE FROM tbl_company
WHERE company_id = ${context.COMPANY_USER_ID};

DELETE FROM tbl_user
WHERE id IN (${context.STUDENT_ID}, ${context.SECOND_STUDENT_ID}, ${context.TEACHER_ID}, ${context.COMPANY_USER_ID})
   OR account_id IN (${sqlString(context.STUDENT_ACCOUNT_ID)}, ${sqlString(context.SECOND_STUDENT_ACCOUNT_ID)}, ${sqlString(context.TEACHER_ACCOUNT_ID)}, ${sqlString(context.COMPANY_ACCOUNT_ID)});

INSERT INTO tbl_user (id, created_at, account_id, password, authority, token) VALUES
(${context.STUDENT_ID}, NOW(), ${sqlString(context.STUDENT_ACCOUNT_ID)}, ${sqlString(context.BCRYPT_PASSWORD)}, 'STUDENT', NULL),
(${context.SECOND_STUDENT_ID}, NOW(), ${sqlString(context.SECOND_STUDENT_ACCOUNT_ID)}, ${sqlString(context.BCRYPT_PASSWORD)}, 'STUDENT', NULL),
(${context.TEACHER_ID}, NOW(), ${sqlString(context.TEACHER_ACCOUNT_ID)}, ${sqlString(context.BCRYPT_PASSWORD)}, 'TEACHER', NULL),
(${context.COMPANY_USER_ID}, NOW(), ${sqlString(context.COMPANY_ACCOUNT_ID)}, ${sqlString(context.BCRYPT_PASSWORD)}, 'COMPANY', NULL);

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
) VALUES
(${context.STUDENT_ID}, ${sqlString(context.STUDENT_NAME)}, 2, 1, 1, 'MAN', 'SOFTWARE_DEVELOP', 'EXTENSION_FILE/default_image.png', ${context.CURRENT_YEAR - 1}),
(${context.SECOND_STUDENT_ID}, ${sqlString(context.SECOND_STUDENT_NAME)}, 2, 1, 2, 'WOMAN', 'SOFTWARE_DEVELOP', 'EXTENSION_FILE/default_image.png', ${context.CURRENT_YEAR - 1});

INSERT INTO tbl_teacher (teacher_id) VALUES (${context.TEACHER_ID});

INSERT INTO tbl_company (
    company_id, name, biz_no, type, is_mou, representative, founded_at, take, workers_count,
    email, company_introduce, company_logo_url, biz_registration_url, business_area, service_name,
    attachment_urls, main_address, main_address_detail, main_zip_code, manager_name, manager_phone_no,
    headquarter, representative_phone_no
) VALUES (
    ${context.COMPANY_USER_ID},
    'HarnessCompany',
    '1234567890',
    'PARTICIPATING',
    1,
    'HarnessRep',
    '2020-01-01',
    12000,
    25,
    'harness-company@example.com',
    'Synthetic company for harness verification.',
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

INSERT INTO tbl_document_number (id, document_number) VALUES (${context.DOCUMENT_NUMBER_ID}, ${sqlString(context.DOCUMENT_NUMBER_VALUE)});
`.trim();
}

function buildInterviewRows({ requestSpec, context, task }) {
  const queryFields = getRequestFieldMap(requestSpec.request?.query_params ?? []);
  const bodyFields = getRequestFieldMap(requestSpec.request?.body?.fields ?? []);
  const responseRows = Array.isArray(requestSpec.responses?.success?.body?.interviews)
    ? requestSpec.responses.success.body.interviews
    : [];
  const method = String(requestSpec.method ?? "GET").toUpperCase();
  const scale = datasetScaleForTask(task, requestSpec);

  const year = Number(queryFields.year ?? context.CURRENT_YEAR);
  const month = Number(queryFields.month ?? 3);
  const monthDate = String(month).padStart(2, "0");
  const baseDate = `${year}-${monthDate}-15`;
  const secondaryDate = `${year}-${monthDate}-20`;
  const requestedType = queryFields.interview_type ?? bodyFields.interview_type ?? "FINAL_INTERVIEW";
  const requestedCompany = limit(queryFields.company_name ?? bodyFields.company_name ?? "HarnessCompanyAlpha", 20);
  const requestedLocation = limit(bodyFields.location ?? "Seoul Gangnam-gu", 80);
  const requestedTime = limit(bodyFields.interview_time ?? "14:00", 8);
  const requestedDate = bodyFields.interview_date ?? bodyFields.start_date ?? baseDate;
  const requestedEndDate = bodyFields.end_date ?? requestedDate;

  const rows = responseRows.length > 0
    ? responseRows.map((row, index) => ({
        id: Number(row.id ?? context[`INTERVIEW_ID_${Math.min(index + 1, 4)}`] ?? context.INTERVIEW_ID_1 + index),
        interview_type: row.interview_type ?? requestedType,
        start_date: row.start_date ?? baseDate,
        end_date: row.end_date ?? row.start_date ?? baseDate,
        interview_time: limit(row.interview_time ?? requestedTime, 8),
        company_name: limit(row.company_name ?? `${requestedCompany}${index}`, 20),
        location: limit(row.location ?? requestedLocation, 80),
        student_id: index === 0 ? context.STUDENT_ID : (index % 2 === 0 ? context.SECOND_STUDENT_ID : context.STUDENT_ID),
        document_number_id: row.document_number_id == null ? null : context.DOCUMENT_NUMBER_ID,
      }))
    : [
        {
          id: context.INTERVIEW_ID_1,
          interview_type: requestedType,
          start_date: baseDate,
          end_date: baseDate,
          interview_time: requestedTime,
          company_name: requestedCompany,
          location: requestedLocation,
          student_id: context.STUDENT_ID,
          document_number_id: context.DOCUMENT_NUMBER_ID,
        }
      ];

  if (method !== "GET" && rows.length === 1) {
    rows[0] = {
      ...rows[0],
      interview_type: bodyFields.interview_type ?? rows[0].interview_type,
      start_date: requestedDate ?? rows[0].start_date,
      end_date: requestedEndDate ?? rows[0].end_date,
      interview_time: limit(bodyFields.interview_time ?? rows[0].interview_time, 8),
      company_name: limit(bodyFields.company_name ?? rows[0].company_name, 20),
      location: limit(bodyFields.location ?? rows[0].location, 80),
    };
  }

  while (rows.length < scale) {
    const index = rows.length;
    rows.push({
      id: context.INTERVIEW_ID_1 + index,
      interview_type: index % 3 === 0 ? requestedType : "TECH_INTERVIEW",
      start_date: index % 2 === 0 ? baseDate : secondaryDate,
      end_date: index % 2 === 0 ? baseDate : secondaryDate,
      interview_time: requestedTime,
      company_name: limit(`${requestedCompany}${index}`, 20),
      location: limit(`Harness Location ${index}`, 80),
      student_id: index % 2 === 0 ? context.STUDENT_ID : context.SECOND_STUDENT_ID,
      document_number_id: index % 2 === 0 ? context.DOCUMENT_NUMBER_ID : null,
    });
  }

  return rows;
}

function buildInterviewFixture({ requestSpec, context, task }) {
  const rows = buildInterviewRows({ requestSpec, context, task });
  const deletes = `
DELETE FROM tbl_interview
WHERE id IN (${rows.map((row) => row.id).join(", ")});
`.trim();

  const inserts = rows.map((row) => `(
    ${row.id},
    ${sqlString(row.interview_type)},
    ${sqlString(row.start_date)},
    ${sqlString(row.end_date)},
    ${sqlString(row.interview_time)},
    ${sqlString(row.company_name)},
    ${sqlString(row.location)},
    ${row.student_id},
    ${sqlNullable(row.document_number_id)}
)`).join(",\n");

  return {
    family: "interviews",
    required_tables: ["tbl_user", "tbl_student", "tbl_teacher", "tbl_document_number", "tbl_company", "tbl_interview"],
    sql: `${deletes}

INSERT INTO tbl_interview (
    id,
    interview_type,
    start_date,
    end_date,
    interview_time,
    company_name,
    location,
    student_id,
    document_number_id
) VALUES
${inserts};`,
  };
}

function buildRecruitmentRows({ requestSpec, context, task }) {
  const responseRows = Array.isArray(requestSpec.responses?.success?.body?.recruitments)
    ? requestSpec.responses.success.body.recruitments
    : [];
  const queryFields = getRequestFieldMap(requestSpec.request?.query_params ?? []);
  const scale = datasetScaleForTask(task, requestSpec);
  const baseCompany = limit(queryFields.company_name ?? "Harness Company", 50);

  const rows = responseRows.length > 0
    ? responseRows.map((row, index) => ({
        recruitment_id: Number(row.id ?? context.RECRUITMENT_ID + index),
        company_id: context.COMPANY_ID + index,
        company_name: limit(row.company_name ?? `${baseCompany}${index}`, 50),
        status: row.status ?? "RECRUITING",
        year: Number(row.year ?? context.CURRENT_YEAR),
      }))
    : [
        {
          recruitment_id: context.RECRUITMENT_ID,
          company_id: context.COMPANY_ID,
          company_name: baseCompany,
          status: "RECRUITING",
          year: context.CURRENT_YEAR,
        }
      ];

  while (rows.length < scale) {
    const index = rows.length;
    rows.push({
      recruitment_id: context.RECRUITMENT_ID + index,
      company_id: context.COMPANY_ID + index,
      company_name: limit(`${baseCompany}${index}`, 50),
      status: index % 2 === 0 ? "RECRUITING" : "CLOSE",
      year: context.CURRENT_YEAR,
    });
  }

  return rows;
}

function buildRecruitmentFixture({ requestSpec, context, task }) {
  const rows = buildRecruitmentRows({ requestSpec, context, task });
  const companyIds = rows.map((row) => row.company_id).join(", ");
  const recruitmentIds = rows.map((row) => row.recruitment_id).join(", ");
  const recruitAreaIds = rows.map((_, index) => context.RECRUIT_AREA_ID + index).join(", ");
  const codeIds = rows.map((_, index) => context.CODE_ID + index).join(", ");

  const deleteSql = `
DELETE FROM tbl_recruit_area_code WHERE recruit_area_id IN (${recruitAreaIds}) OR code_id IN (${codeIds});
DELETE FROM tbl_recruit_area WHERE id IN (${recruitAreaIds});
DELETE FROM tbl_recruitment WHERE id IN (${recruitmentIds});
DELETE FROM tbl_company WHERE company_id IN (${companyIds});
DELETE FROM tbl_code WHERE code IN (${codeIds});
`.trim();

  const companySql = rows.map((row, index) => `(
    ${row.company_id},
    ${sqlString(row.company_name)},
    ${sqlString(`12345${String(index).padStart(5, "0")}`)},
    'PARTICIPATING',
    1,
    ${sqlString("HarnessRep")},
    '2020-01-01',
    12000,
    25,
    ${sqlString(`company${index}@example.com`)},
    ${sqlString("Synthetic company for harness recruitment verification.")},
    'LOGO_IMAGE/companydefault.png',
    NULL,
    'Software',
    ${sqlString(limit(`HarnessPlatform${index}`, 40))},
    NULL,
    ${sqlString(limit(`Daejeon Address ${index}`, 50))},
    ${sqlString(limit(`Suite ${index}`, 50))},
    '34141',
    ${sqlString("HarnessMgr")},
    '01087654321',
    1,
    '01012345678'
)`).join(",\n");

  const recruitmentSql = rows.map((row, index) => `(
    ${row.recruitment_id},
    NOW(),
    ${row.year},
    ${sqlString(row.status)},
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
    ${row.company_id},
    CURDATE() - INTERVAL 3 DAY,
    CURDATE() + INTERVAL 30 DAY,
    2500000,
    'Negotiable',
    1,
    0
)`).join(",\n");

  const recruitAreaSql = rows.map((row, index) => `(
    ${context.RECRUIT_AREA_ID + index},
    2,
    'Backend development for harness recruitment listing verification',
    'Docker and API testing experience',
    ${row.recruitment_id}
)`).join(",\n");

  const codeSql = rows.map((row, index) => `(
    ${context.CODE_ID + index},
    'JOB',
    'WEB',
    ${sqlString(limit(`HarnessBackend${index}`, 30))},
    1,
    NULL
)`).join(",\n");

  const recruitAreaCodeSql = rows.map((row, index) => `(
    'JOB',
    ${context.RECRUIT_AREA_ID + index},
    ${context.CODE_ID + index}
)`).join(",\n");

  return {
    family: "recruitments",
    required_tables: ["tbl_user", "tbl_student", "tbl_teacher", "tbl_document_number", "tbl_company", "tbl_recruitment", "tbl_recruit_area", "tbl_recruit_area_code", "tbl_code"],
    sql: `${deleteSql}

INSERT INTO tbl_company (
    company_id, name, biz_no, type, is_mou, representative, founded_at, take, workers_count,
    email, company_introduce, company_logo_url, biz_registration_url, business_area, service_name,
    attachment_urls, main_address, main_address_detail, main_zip_code, manager_name, manager_phone_no,
    headquarter, representative_phone_no
) VALUES
${companySql};

INSERT INTO tbl_recruitment (
    id, created_at, recruit_year, status, required_licenses, additional_qualifications,
    working_hours, flexible_working, benefits, military_support, hiring_progress, submit_document,
    etc, personal_contact, winter_intern, company_id, start_date, finish_date, train_pay, pay,
    hire_convertible, integration_plan
) VALUES
${recruitmentSql};

INSERT INTO tbl_recruit_area (
    id, hired_count, major_task, preferential_treatment, recruitment_id
) VALUES
${recruitAreaSql};

INSERT INTO tbl_code (
    code, type, job_type, keyword, is_public, parent_code_id
) VALUES
${codeSql};

INSERT INTO tbl_recruit_area_code (
    type, recruit_area_id, code_id
) VALUES
${recruitAreaCodeSql};`,
  };
}

function buildNoticeRows({ requestSpec, task, table }) {
  const responseBody = requestSpec.responses?.success?.body ?? {};
  const key = table === "tbl_notice" ? "notices" : "banners";
  const items = Array.isArray(responseBody[key]) ? responseBody[key] : [];
  const scale = datasetScaleForTask(task, requestSpec);

  const rows = items.length > 0
    ? items.map((item, index) => ({
        id: Number(item.id ?? index + 1),
        title: limit(item.title ?? `${key}-title-${index}`, table === "tbl_notice" ? 50 : 100),
        content: limit(item.content ?? `${key}-content-${index}`, table === "tbl_notice" ? 1000 : 500),
        start_date: item.start_date ?? "2026-03-01",
        end_date: item.end_date ?? "2026-03-31",
        banner_type: item.banner_type ?? "NOTICE",
        detail_id: item.detail_id ?? null,
      }))
    : [
        {
          id: 1,
          title: key === "notices" ? "Harness Notice" : "Harness Banner",
          content: "Synthetic content",
          start_date: "2026-03-01",
          end_date: "2026-03-31",
          banner_type: "NOTICE",
          detail_id: null,
        }
      ];

  while (rows.length < Math.min(scale, 10)) {
    const index = rows.length;
    rows.push({
      id: index + 1,
      title: limit(`${key}-title-${index}`, table === "tbl_notice" ? 50 : 100),
      content: limit(`${key}-content-${index}`, table === "tbl_notice" ? 1000 : 500),
      start_date: "2026-03-01",
      end_date: "2026-03-31",
      banner_type: index % 2 === 0 ? "NOTICE" : "EMPLOYMENT",
      detail_id: null,
    });
  }

  return rows;
}

function buildNoticeFixture({ requestSpec, task }) {
  const rows = buildNoticeRows({ requestSpec, task, table: "tbl_notice" });
  const ids = rows.map((row) => row.id).join(", ");
  const sqlRows = rows.map((row) => `(${row.id}, NOW(), ${sqlString(row.title)}, ${sqlString(row.content)})`).join(",\n");
  return {
    family: "notices",
    required_tables: ["tbl_notice"],
    sql: `DELETE FROM tbl_notice WHERE id IN (${ids});

INSERT INTO tbl_notice (id, created_at, title, content) VALUES
${sqlRows};`,
  };
}

function buildBannerFixture({ requestSpec, task }) {
  const rows = buildNoticeRows({ requestSpec, task, table: "tbl_banner" });
  const ids = rows.map((row) => row.id).join(", ");
  const sqlRows = rows.map((row) => `(
    ${row.id},
    ${sqlString(row.title)},
    ${sqlString(row.content)},
    ${sqlString(row.banner_type)},
    ${sqlString(row.start_date)},
    ${sqlString(row.end_date)},
    ${sqlNullable(row.detail_id)}
)`).join(",\n");
  return {
    family: "banners",
    required_tables: ["tbl_banner"],
    sql: `DELETE FROM tbl_banner WHERE id IN (${ids});

INSERT INTO tbl_banner (id, title, content, banner_type, start_date, end_date, detail_id) VALUES
${sqlRows};`,
  };
}

function buildBugFixture({ requestSpec, context, task }) {
  const responseBody = requestSpec.responses?.success?.body ?? {};
  const items = Array.isArray(responseBody.bugs) ? responseBody.bugs : [];
  const scale = Math.min(datasetScaleForTask(task, requestSpec), 8);
  const rows = items.length > 0
    ? items.map((bug, index) => ({
        id: Number(bug.id ?? index + 1),
        title: limit(bug.title ?? `bug-${index}`, 20),
        content: limit(bug.content ?? "Synthetic bug report", 400),
        development_area: bug.development_area ?? "FRONTEND",
        student_id: context.STUDENT_ID,
      }))
    : [
        {
          id: 1,
          title: "bug-0",
          content: "Synthetic bug report",
          development_area: "FRONTEND",
          student_id: context.STUDENT_ID,
        }
      ];

  while (rows.length < scale) {
    const index = rows.length;
    rows.push({
      id: index + 1,
      title: limit(`bug-${index}`, 20),
      content: "Synthetic bug report",
      development_area: index % 2 === 0 ? "FRONTEND" : "BACKEND",
      student_id: context.STUDENT_ID,
    });
  }

  const ids = rows.map((row) => row.id).join(", ");
  const sqlRows = rows.map((row) => `(${row.id}, NOW(), ${sqlString(row.title)}, ${sqlString(row.content)}, ${sqlString(row.development_area)}, ${row.student_id})`).join(",\n");
  return {
    family: "bugs",
    required_tables: ["tbl_user", "tbl_student", "tbl_teacher", "tbl_document_number", "tbl_bug_report"],
    sql: `DELETE FROM tbl_bug_report WHERE id IN (${ids});

INSERT INTO tbl_bug_report (id, created_at, title, content, development_area, student_id) VALUES
${sqlRows};`,
  };
}

export function buildDynamicScenarioFixture({ requestSpec, context, task }) {
  const family = inferFamily(requestSpec);
  if (family === "interviews") return buildInterviewFixture({ requestSpec, context, task });
  if (family === "recruitments") return buildRecruitmentFixture({ requestSpec, context, task });
  if (family === "notices") return buildNoticeFixture({ requestSpec, task });
  if (family === "banners") return buildBannerFixture({ requestSpec, task });
  if (family === "bugs") return buildBugFixture({ requestSpec, context, task });

  return {
    family: "generic",
    required_tables: ["tbl_user", "tbl_student", "tbl_teacher", "tbl_document_number", "tbl_company"],
    sql: "",
  };
}

export function buildContextSeed({ fixtureKey, requestSpec, now = new Date() }) {
  const seed = `${fixtureKey}_${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  const requestQuery = requestSpec?.request?.query_params ?? [];
  const year = Number(findExample(requestQuery, "year", now.getFullYear() + 1));

  return {
    RUN_ID: quoteIdentifier(seed.toUpperCase()),
    CURRENT_YEAR: now.getFullYear(),
    STUDENT_ID: 10001,
    SECOND_STUDENT_ID: 10002,
    TEACHER_ID: 10003,
    COMPANY_USER_ID: 10004,
    DOCUMENT_NUMBER_ID: 10011,
    INTERVIEW_ID_1: 11001,
    INTERVIEW_ID_2: 11002,
    INTERVIEW_ID_3: 11003,
    INTERVIEW_ID_4: 11004,
    RECRUITMENT_ID: 30001,
    COMPANY_ID: 20001,
    RECRUIT_AREA_ID: 40001,
    CODE_ID: 50001,
    STUDENT_ACCOUNT_ID: "harness.student.01",
    SECOND_STUDENT_ACCOUNT_ID: "harness.student.02",
    TEACHER_ACCOUNT_ID: "harness.teacher.01",
    COMPANY_ACCOUNT_ID: "harness.company.01",
    STUDENT_NAME: "HStudent1",
    SECOND_STUDENT_NAME: "HStudent2",
    DOCUMENT_NUMBER_VALUE: `D${String(year).slice(-2)}001`,
    BCRYPT_PASSWORD: "$2a$10$fK42cS5/08WVME6T9J7jmuCa9081s/XKqWQ18tWY4ERmjSG4V1f0a",
  };
}

export function renderBaseIdentitySql(context) {
  return buildBaseIdentitySql(context);
}
