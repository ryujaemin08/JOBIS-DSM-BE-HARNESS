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
(
    {{INTERVIEW_ID_1}},
    '{{QUERY_INTERVIEW_TYPE}}',
    '{{QUERY_START_DATE}}',
    '{{QUERY_END_DATE}}',
    '14:00',
    '{{QUERY_COMPANY_NAME}}',
    'Seoul Gangnam-gu',
    {{STUDENT_ID}},
    {{DOCUMENT_NUMBER_ID}}
),
(
    {{INTERVIEW_ID_2}},
    'TECH_INTERVIEW',
    '{{QUERY_MONTH_EXTRA_DATE}}',
    '{{QUERY_MONTH_EXTRA_DATE}}',
    '15:00',
    '{{QUERY_SECOND_COMPANY_NAME}}',
    'Seoul Seocho-gu',
    {{STUDENT_ID}},
    {{DOCUMENT_NUMBER_ID}}
),
(
    {{INTERVIEW_ID_3}},
    'FINAL_INTERVIEW',
    '{{QUERY_MONTH_EXTRA_DATE}}',
    '{{QUERY_MONTH_EXTRA_DATE}}',
    '16:00',
    '{{QUERY_THIRD_COMPANY_NAME}}',
    'Seoul Songpa-gu',
    {{SECOND_STUDENT_ID}},
    NULL
);
