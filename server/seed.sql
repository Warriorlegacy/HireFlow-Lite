-- HireFlow Lite — synthetic demo data only. No real candidate information.
-- Password for every demo team account: DemoPass123!
-- Candidate portal demo tokens are documented in README (synthetic persona).

DELETE FROM rate_limits;
DELETE FROM usage_limits;
DELETE FROM audit_events;
DELETE FROM deletion_requests;
DELETE FROM retention_rules;
DELETE FROM candidate_portal_tokens;
DELETE FROM communication_events;
DELETE FROM communication_templates;
DELETE FROM feedback;
DELETE FROM scorecard_responses;
DELETE FROM scorecards;
DELETE FROM interview_participants;
DELETE FROM interviews;
DELETE FROM source_attributions;
DELETE FROM stage_events;
DELETE FROM candidate_consents;
DELETE FROM file_blobs;
DELETE FROM resume_files;
DELETE FROM application_answers;
DELETE FROM applications;
DELETE FROM candidates;
DELETE FROM scorecard_items;
DELETE FROM scorecard_templates;
DELETE FROM pipeline_stages;
DELETE FROM job_memberships;
DELETE FROM jobs;
DELETE FROM invitations;
DELETE FROM sessions;
DELETE FROM memberships;
DELETE FROM users;
DELETE FROM organizations;

INSERT INTO organizations (id,name,slug,website,careers_intro,timezone,privacy_notice_version,privacy_notice_url,default_retention_days,ai_enabled,email_provider,email_from,created_at,updated_at)
VALUES ('org_fieldnote','Fieldnote Labs','fieldnote-labs','https://fieldnote.example','We build calm tools for research teams. We hire slowly, read every application, and tell every candidate where they stand.','Asia/Kolkata','2026-11-01','/privacy',365,0,NULL,NULL,1794000000000,1794614400000);

INSERT INTO users (id,email,password_hash,full_name,is_active,created_at,updated_at) VALUES
('usr_ananya','owner@hireflow.demo','pbkdf2$25000$6df62535de2b53707e7980e1d0e172fe$615ad8c13312f2b545246630016b319d3c69d4302a910f369abd953500b26eab','Ananya Rao',1,1794000000000,1794614400000),
('usr_marcus','admin@hireflow.demo','pbkdf2$25000$6df62535de2b53707e7980e1d0e172fe$615ad8c13312f2b545246630016b319d3c69d4302a910f369abd953500b26eab','Marcus Bell',1,1794000000000,1794614400000),
('usr_priya','recruiter@hireflow.demo','pbkdf2$25000$6df62535de2b53707e7980e1d0e172fe$615ad8c13312f2b545246630016b319d3c69d4302a910f369abd953500b26eab','Priya Nair',1,1794000000000,1794614400000),
('usr_daniel','manager@hireflow.demo','pbkdf2$25000$6df62535de2b53707e7980e1d0e172fe$615ad8c13312f2b545246630016b319d3c69d4302a910f369abd953500b26eab','Daniel Cho',1,1794000000000,1794614400000),
('usr_sofia','interviewer@hireflow.demo','pbkdf2$25000$6df62535de2b53707e7980e1d0e172fe$615ad8c13312f2b545246630016b319d3c69d4302a910f369abd953500b26eab','Sofia Lind',1,1794000000000,1794614400000),
('usr_imran','imran@hireflow.demo','pbkdf2$25000$6df62535de2b53707e7980e1d0e172fe$615ad8c13312f2b545246630016b319d3c69d4302a910f369abd953500b26eab','Imran Haddad',1,1794000000000,1794614400000);

INSERT INTO memberships (id,organization_id,user_id,role,title,status,created_at,updated_at) VALUES
('mem_ananya','org_fieldnote','usr_ananya','owner','Founder','active',1794000000000,1794000000000),
('mem_marcus','org_fieldnote','usr_marcus','admin','Head of Operations','active',1794000000000,1794000000000),
('mem_priya','org_fieldnote','usr_priya','recruiter','Talent Partner','active',1794000000000,1794000000000),
('mem_daniel','org_fieldnote','usr_daniel','hiring_manager','Engineering Manager','active',1794000000000,1794000000000),
('mem_sofia','org_fieldnote','usr_sofia','interviewer','Staff Designer','active',1794000000000,1794000000000),
('mem_imran','org_fieldnote','usr_imran','interviewer','Data Lead','active',1794000000000,1794000000000);

INSERT INTO pipeline_stages (id,organization_id,key,name,position,kind,created_at) VALUES
('stg_new','org_fieldnote','new','New',0,'active',1794000000000),
('stg_screening','org_fieldnote','screening','Screening',1,'active',1794000000000),
('stg_interview','org_fieldnote','interview','Interview',2,'active',1794000000000),
('stg_assessment','org_fieldnote','assessment','Assessment',3,'active',1794000000000),
('stg_offer','org_fieldnote','offer','Offer',4,'offer',1794000000000),
('stg_hired','org_fieldnote','hired','Hired',5,'hired',1794000000000),
('stg_rejected','org_fieldnote','rejected','Rejected',6,'rejected',1794000000000),
('stg_withdrawn','org_fieldnote','withdrawn','Withdrawn',7,'withdrawn',1794000000000);

INSERT INTO jobs (id,organization_id,slug,title,department,location,work_mode,employment_type,salary_min,salary_max,salary_currency,description,responsibilities,qualifications,application_deadline,hiring_owner_id,status,published_at,closed_at,privacy_notice_version,application_fields_json,created_by_user_id,created_at,updated_at) VALUES
('job_design','org_fieldnote','senior-product-designer','Senior Product Designer','Design','Bengaluru','hybrid','full_time',1800000,2600000,'INR','We are looking for a senior product designer who can hold the whole shape of a workflow: the research, the quiet interface, and the handoff. You will work directly with two engineers and a researcher on our field notes product.','Lead design for the capture and review workflow. Run lightweight research with research teams. Ship accessible, considered interfaces. Mentor one mid-level designer.','5+ years designing software products. A portfolio that shows decisions, not only screens. Comfortable writing and testing your own copy. Experience with research or data tools is a plus.','2026-12-15','usr_daniel','published',1794300000000,NULL,'2026-11-01','[{"key":"portfolio","label":"Portfolio URL","type":"url","required":true},{"key":"process","label":"Tell us about a design decision you changed your mind about","type":"textarea","required":true}]','usr_ananya',1794200000000,1794614400000),
('job_engineer','org_fieldnote','product-engineer','Product Engineer','Engineering','Remote (India)','remote','full_time',2200000,3200000,'INR','Join a small product team building tools for qualitative research. You will own features end to end, from schema to the last empty state.','Build and ship product features in TypeScript. Own data modelling and API design. Work with design on interaction detail. Keep the on-call surface small.','4+ years building web products. Strong TypeScript and SQL. Care about accessibility and performance. Experience with Cloudflare or serverless is welcome.','2026-12-01','usr_daniel','published',1794300000000,NULL,'2026-11-01','[{"key":"project","label":"Describe a product you shipped end to end","type":"textarea","required":true}]','usr_ananya',1794200000000,1794614400000),
('job_research','org_fieldnote','research-operations-lead','Research Operations Lead','Research','Mumbai','onsite','full_time',1500000,2100000,'INR','Own the operating rhythm of our research practice: recruiting participants, consent, scheduling, and the care of participant data.','Run participant recruitment and scheduling. Maintain consent and retention records. Improve research operations with the product team.','3+ years in research operations or program management. Detail-oriented with participant privacy. Excellent written communication.','2026-11-30','usr_priya','published',1794300000000,NULL,'2026-11-01','[]','usr_priya',1794200000000,1794614400000),
('job_support','org_fieldnote','customer-support-specialist','Customer Support Specialist','Operations','Bengaluru','hybrid','full_time',700000,950000,'INR','Be the first reply for research teams using Fieldnote. This role is for someone who writes clearly, investigates patiently, and turns repeated questions into documentation.','Answer support requests within one business day. Maintain help content. Triage bugs with engineering. Track recurring themes.','2+ years in customer support. Clear, kind writing. Comfortable with technical products.','2026-10-31','usr_marcus','draft',NULL,NULL,'2026-11-01','[]','usr_marcus',1794300000000,1794614400000),
('job_ops','org_fieldnote','finance-ops-associate','Finance & Operations Associate','Operations','Bengaluru','onsite','full_time',800000,1100000,'INR','Support our finance and people operations as we grow from 18 to 30 people. A careful, systems-minded generalist role.','Own monthly invoicing and collections. Support payroll inputs and vendor contracts. Improve internal operating docs.','2+ years in finance or operations. Strong spreadsheets. Discretion with confidential information.','2026-09-30','usr_marcus','closed',1794300000000,1794480000000,'2026-11-01','[]','usr_marcus',1794200000000,1794480000000);

INSERT INTO job_memberships (id,organization_id,job_id,user_id,role,created_at) VALUES
('jm_design_priya','org_fieldnote','job_design','usr_priya','recruiter',1794300000000),
('jm_design_daniel','org_fieldnote','job_design','usr_daniel','hiring_manager',1794300000000),
('jm_design_sofia','org_fieldnote','job_design','usr_sofia','interviewer',1794300000000),
('jm_eng_priya','org_fieldnote','job_engineer','usr_priya','recruiter',1794300000000),
('jm_eng_daniel','org_fieldnote','job_engineer','usr_daniel','hiring_manager',1794300000000),
('jm_eng_imran','org_fieldnote','job_engineer','usr_imran','interviewer',1794300000000),
('jm_research_priya','org_fieldnote','job_research','usr_priya','recruiter',1794300000000),
('jm_support_marcus','org_fieldnote','job_support','usr_marcus','hiring_manager',1794300000000);

INSERT INTO scorecard_templates (id,organization_id,job_id,name,description,created_at) VALUES
('sct_design','org_fieldnote','job_design','Product design interview','Assess craft, product judgement, and collaboration through concrete examples.',1794300000000),
('sct_eng','org_fieldnote','job_engineer','Product engineering interview','Assess technical depth, product sense, and communication.',1794300000000);

INSERT INTO scorecard_items (id,organization_id,template_id,competency,description,anchors_json,position,created_at) VALUES
('sci_design_craft','org_fieldnote','sct_design','Interface craft','Quality of interaction and visual decisions, with accessibility considered.','{"1":"Screens only, no rationale","3":"Clear rationale, solid execution","5":"Exemplary craft and accessible detail"}',0,1794300000000),
('sci_design_judgement','org_fieldnote','sct_design','Product judgement','Frames the problem before proposing a solution. Uses evidence.','{"1":"Jumps to solution","3":"Frames the problem with some evidence","5":"Sharp framing, tests assumptions early"}',1,1794300000000),
('sci_design_collab','org_fieldnote','sct_design','Collaboration','Works with engineers and researchers; gives and takes feedback well.','{"1":"Unclear ownership","3":"Works well with the immediate team","5":"Raises the quality of everyone around them"}',2,1794300000000),
('sci_eng_depth','org_fieldnote','sct_eng','Technical depth','Data modelling, API design, and debugging judgement.','{"1":"Surface knowledge","3":"Solid, can defend trade-offs","5":"Deep, simplifies hard problems"}',0,1794300000000),
('sci_eng_product','org_fieldnote','sct_eng','Product sense','Turns ambiguity into a small, correct slice of product.','{"1":"Needs detailed direction","3":"Ships a sensible slice","5":"Finds the smallest valuable slice"}',1,1794300000000),
('sci_eng_comms','org_fieldnote','sct_eng','Communication','Writes and speaks clearly about technical decisions.','{"1":"Hard to follow","3":"Clear in writing and review","5":"Makes complexity legible"}',2,1794300000000);

INSERT INTO candidates (id,organization_id,full_name,email,phone,location,linkedin_url,portfolio_url,created_at,updated_at,anonymized_at) VALUES
('cand_maya','org_fieldnote','Maya Krishnan','maya.krishnan@example.test','+91 98450 11021','Bengaluru','https://linkedin.com/in/example-maya','https://maya.example.test',1794310000000,1794614400000,NULL),
('cand_arjun','org_fieldnote','Arjun Mehta','arjun.mehta@example.test','+91 99870 22109','Pune','https://linkedin.com/in/example-arjun',NULL,1794315000000,1794614400000,NULL),
('cand_lena','org_fieldnote','Lena Fischer','lena.fischer@example.test',NULL,'Berlin','https://linkedin.com/in/example-lena','https://lena.example.test',1794320000000,1794614400000,NULL),
('cand_omar','org_fieldnote','Omar Haddad','omar.haddad@example.test','+91 98200 44510','Mumbai',NULL,NULL,1794330000000,1794614400000,NULL),
('cand_priyanka','org_fieldnote','Priyanka Desai','priyanka.desai@example.test','+91 90040 55218','Ahmedabad','https://linkedin.com/in/example-priyanka','https://priyanka.example.test',1794340000000,1794614400000,NULL),
('cand_tomas','org_fieldnote','Tomas Novak','tomas.novak@example.test',NULL,'Prague','https://linkedin.com/in/example-tomas',NULL,1794350000000,1794614400000,NULL),
('cand_asha','org_fieldnote','Asha Pillai','asha.pillai@example.test','+91 97400 66321','Kochi','https://linkedin.com/in/example-asha','https://asha.example.test',1794360000000,1794614400000,NULL),
('cand_ethan','org_fieldnote','Ethan Brooks','ethan.brooks@example.test',NULL,'Toronto','https://linkedin.com/in/example-ethan',NULL,1794370000000,1794614400000,NULL),
('cand_nadia','org_fieldnote','Nadia Rahman','nadia.rahman@example.test','+91 98110 77432','Delhi','https://linkedin.com/in/example-nadia','https://nadia.example.test',1794380000000,1794614400000,NULL),
('cand_josef','org_fieldnote','Josef Marek','josef.marek@example.test',NULL,'Brno',NULL,NULL,1794390000000,1794614400000,NULL),
('cand_grace','org_fieldnote','Grace Okafor','grace.okafor@example.test','+91 98670 88543','Bengaluru','https://linkedin.com/in/example-grace',NULL,1794400000000,1794614400000,NULL),
('cand_hugo','org_fieldnote','Hugo Silva','hugo.silva@example.test',NULL,'Lisbon','https://linkedin.com/in/example-hugo','https://hugo.example.test',1794410000000,1794614400000,NULL);

INSERT INTO applications (id,organization_id,job_id,candidate_id,stage_id,status,source,source_detail,cover_note,resume_file_id,owner_user_id,applied_at,stage_entered_at,first_reviewed_at,rejection_reason,withdrawn_at,anonymized_at,updated_at) VALUES
('app_maya','org_fieldnote','job_design','cand_maya','stg_interview','active','referral','Referred by Sofia Lind','I have spent the last four years on research tooling and would love to work on the review workflow. A short case study is in my portfolio.',NULL,'usr_priya',1794310000000,1794520000000,1794320000000,NULL,NULL,NULL,1794614400000),
('app_arjun','org_fieldnote','job_design','cand_arjun','stg_screening','active','careers_page','Direct application',NULL,NULL,'usr_priya',1794315000000,1794315000000,NULL,NULL,NULL,NULL,1794614400000),
('app_lena','org_fieldnote','job_design','cand_lena','stg_offer','active','linkedin','Posted by Daniel Cho',NULL,NULL,'usr_priya',1794320000000,1794570000000,1794330000000,NULL,NULL,NULL,1794614400000),
('app_omar','org_fieldnote','job_engineer','cand_omar','stg_assessment','active','careers_page','Direct application',NULL,NULL,'usr_priya',1794330000000,1794550000000,1794340000000,NULL,NULL,NULL,1794614400000),
('app_priyanka','org_fieldnote','job_engineer','cand_priyanka','stg_interview','active','referral','Referred by Imran Haddad',NULL,NULL,'usr_priya',1794340000000,1794540000000,1794350000000,NULL,NULL,NULL,1794614400000),
('app_tomas','org_fieldnote','job_engineer','cand_tomas','stg_new','active','careers_page','Direct application',NULL,NULL,'usr_priya',1794350000000,1794350000000,NULL,NULL,NULL,NULL,1794614400000),
('app_asha','org_fieldnote','job_research','cand_asha','stg_screening','active','careers_page','Direct application',NULL,NULL,'usr_priya',1794360000000,1794360000000,NULL,NULL,NULL,NULL,1794614400000),
('app_ethan','org_fieldnote','job_research','cand_ethan','stg_rejected','rejected','job_board','Wellfound',NULL,NULL,'usr_priya',1794370000000,1794500000000,1794380000000,'Not enough direct research-operations experience for this opening.',NULL,NULL,1794614400000),
('app_nadia','org_fieldnote','job_design','cand_nadia','stg_assessment','active','careers_page','Direct application',NULL,NULL,'usr_priya',1794380000000,1794530000000,1794390000000,NULL,NULL,NULL,1794614400000),
('app_josef','org_fieldnote','job_engineer','cand_josef','stg_rejected','rejected','careers_page','Direct application',NULL,NULL,'usr_priya',1794390000000,1794490000000,1794400000000,'Withdrew after accepting another offer.',NULL,NULL,1794614400000),
('app_grace','org_fieldnote','job_research','cand_grace','stg_hired','hired','referral','Referred by Priya Nair',NULL,NULL,'usr_priya',1794400000000,1794480000000,1794410000000,NULL,NULL,NULL,1794614400000),
('app_hugo','org_fieldnote','job_design','cand_hugo','stg_new','active','careers_page','Direct application',NULL,NULL,'usr_priya',1794410000000,1794410000000,NULL,NULL,NULL,NULL,1794614400000);

INSERT INTO application_answers (id,organization_id,application_id,field_key,question,answer,created_at) VALUES
('ans_maya_process','org_fieldnote','app_maya','process','Tell us about a design decision you changed your mind about','We originally put every annotation on one canvas. Watching three researchers work, we saw they never reviewed alone. We split the canvas into a reading mode and an editing mode, and review time dropped without losing a single note.',1794310000000),
('ans_nadia_process','org_fieldnote','app_nadia','process','Tell us about a design decision you changed your mind about','I moved our empty state from a checklist to one concrete example. It looked less thorough, but new users finished setup twice as often.',1794380000000);

INSERT INTO candidate_consents (id,organization_id,application_id,purpose,notice_version,granted,source,created_at,withdrawn_at) VALUES
('con_maya','org_fieldnote','app_maya','application_review','2026-11-01',1,'careers_form',1794310000000,NULL),
('con_arjun','org_fieldnote','app_arjun','application_review','2026-11-01',1,'careers_form',1794315000000,NULL),
('con_lena','org_fieldnote','app_lena','application_review','2026-11-01',1,'careers_form',1794320000000,NULL),
('con_omar','org_fieldnote','app_omar','application_review','2026-11-01',1,'careers_form',1794330000000,NULL),
('con_priyanka','org_fieldnote','app_priyanka','application_review','2026-11-01',1,'careers_form',1794340000000,NULL),
('con_tomas','org_fieldnote','app_tomas','application_review','2026-11-01',1,'careers_form',1794350000000,NULL),
('con_asha','org_fieldnote','app_asha','application_review','2026-11-01',1,'careers_form',1794360000000,NULL),
('con_ethan','org_fieldnote','app_ethan','application_review','2026-11-01',1,'careers_form',1794370000000,1794614400000),
('con_nadia','org_fieldnote','app_nadia','application_review','2026-11-01',1,'careers_form',1794380000000,NULL),
('con_josef','org_fieldnote','app_josef','application_review','2026-11-01',1,'careers_form',1794390000000,NULL),
('con_grace','org_fieldnote','app_grace','application_review','2026-11-01',1,'careers_form',1794400000000,NULL),
('con_hugo','org_fieldnote','app_hugo','application_review','2026-11-01',1,'careers_form',1794410000000,NULL);

INSERT INTO stage_events (id,organization_id,application_id,from_stage_id,to_stage_id,actor_user_id,reason,created_at) VALUES
('sev_maya_1','org_fieldnote','app_maya',NULL,'stg_new','usr_priya','Application received',1794310000000),
('sev_maya_2','org_fieldnote','app_maya','stg_new','stg_screening','usr_priya','Strong research-tooling portfolio',1794320000000),
('sev_maya_3','org_fieldnote','app_maya','stg_screening','stg_interview','usr_daniel','Portfolio review passed',1794520000000),
('sev_arjun_1','org_fieldnote','app_arjun',NULL,'stg_new','usr_priya','Application received',1794315000000),
('sev_arjun_2','org_fieldnote','app_arjun','stg_new','stg_screening','usr_priya','Portfolio shortlist',1794510000000),
('sev_lena_1','org_fieldnote','app_lena',NULL,'stg_new','usr_priya','Application received',1794320000000),
('sev_lena_2','org_fieldnote','app_lena','stg_new','stg_screening','usr_priya','Senior craft, relevant domain',1794350000000),
('sev_lena_3','org_fieldnote','app_lena','stg_screening','stg_interview','usr_daniel','Interview completed',1794450000000),
('sev_lena_4','org_fieldnote','app_lena','stg_interview','stg_offer','usr_ananya','Offer approved after debrief',1794570000000),
('sev_omar_1','org_fieldnote','app_omar',NULL,'stg_new','usr_priya','Application received',1794330000000),
('sev_omar_2','org_fieldnote','app_omar','stg_new','stg_screening','usr_priya','Code sample reviewed',1794340000000),
('sev_omar_3','org_fieldnote','app_omar','stg_screening','stg_interview','usr_daniel','Technical screen passed',1794420000000),
('sev_omar_4','org_fieldnote','app_omar','stg_interview','stg_assessment','usr_daniel','Take-home assessment sent',1794550000000),
('sev_priyanka_1','org_fieldnote','app_priyanka',NULL,'stg_new','usr_priya','Application received',1794340000000),
('sev_priyanka_2','org_fieldnote','app_priyanka','stg_new','stg_screening','usr_priya','Relevant platform work',1794350000000),
('sev_priyanka_3','org_fieldnote','app_priyanka','stg_screening','stg_interview','usr_daniel','Technical screen passed',1794540000000),
('sev_tomas_1','org_fieldnote','app_tomas',NULL,'stg_new','usr_priya','Application received',1794350000000),
('sev_asha_1','org_fieldnote','app_asha',NULL,'stg_new','usr_priya','Application received',1794360000000),
('sev_asha_2','org_fieldnote','app_asha','stg_new','stg_screening','usr_priya','Research ops background',1794460000000),
('sev_ethan_1','org_fieldnote','app_ethan',NULL,'stg_new','usr_priya','Application received',1794370000000),
('sev_ethan_2','org_fieldnote','app_ethan','stg_new','stg_screening','usr_priya','Screening call held',1794380000000),
('sev_ethan_3','org_fieldnote','app_ethan','stg_screening','stg_rejected','usr_priya','Not enough direct research-operations experience for this opening.',1794500000000),
('sev_nadia_1','org_fieldnote','app_nadia',NULL,'stg_new','usr_priya','Application received',1794380000000),
('sev_nadia_2','org_fieldnote','app_nadia','stg_new','stg_screening','usr_priya','Portfolio shortlist',1794390000000),
('sev_nadia_3','org_fieldnote','app_nadia','stg_screening','stg_interview','usr_daniel','Portfolio review passed',1794450000000),
('sev_nadia_4','org_fieldnote','app_nadia','stg_interview','stg_assessment','usr_daniel','Assessment sent after interview',1794530000000),
('sev_josef_1','org_fieldnote','app_josef',NULL,'stg_new','usr_priya','Application received',1794390000000),
('sev_josef_2','org_fieldnote','app_josef','stg_new','stg_rejected','usr_priya','Withdrew after accepting another offer.',1794490000000),
('sev_grace_1','org_fieldnote','app_grace',NULL,'stg_new','usr_priya','Application received',1794400000000),
('sev_grace_2','org_fieldnote','app_grace','stg_new','stg_screening','usr_priya','Strong ops background',1794410000000),
('sev_grace_3','org_fieldnote','app_grace','stg_screening','stg_interview','usr_daniel','Screening passed',1794440000000),
('sev_grace_4','org_fieldnote','app_grace','stg_interview','stg_offer','usr_priya','Offer approved',1794470000000),
('sev_grace_5','org_fieldnote','app_grace','stg_offer','stg_hired','usr_ananya','Offer accepted',1794480000000),
('sev_hugo_1','org_fieldnote','app_hugo',NULL,'stg_new','usr_priya','Application received',1794410000000);

INSERT INTO source_attributions (id,organization_id,application_id,source,detail,utm_json,created_at) VALUES
('src_maya','org_fieldnote','app_maya','referral','Referred by Sofia Lind','{}',1794310000000),
('src_arjun','org_fieldnote','app_arjun','careers_page','Direct application','{}',1794315000000),
('src_lena','org_fieldnote','app_lena','linkedin','Posted by Daniel Cho','{}',1794320000000),
('src_omar','org_fieldnote','app_omar','careers_page','Direct application','{}',1794330000000),
('src_priyanka','org_fieldnote','app_priyanka','referral','Referred by Imran Haddad','{}',1794340000000),
('src_tomas','org_fieldnote','app_tomas','careers_page','Direct application','{}',1794350000000),
('src_asha','org_fieldnote','app_asha','careers_page','Direct application','{}',1794360000000),
('src_ethan','org_fieldnote','app_ethan','job_board','Wellfound','{}',1794370000000),
('src_nadia','org_fieldnote','app_nadia','careers_page','Direct application','{}',1794380000000),
('src_josef','org_fieldnote','app_josef','careers_page','Direct application','{}',1794390000000),
('src_grace','org_fieldnote','app_grace','referral','Referred by Priya Nair','{}',1794400000000),
('src_hugo','org_fieldnote','app_hugo','careers_page','Direct application','{}',1794410000000);

INSERT INTO interviews (id,organization_id,job_id,application_id,title,format,start_at,end_at,timezone,location,meeting_url,candidate_notes,status,created_by_user_id,created_at,updated_at) VALUES
('int_maya_1','org_fieldnote','job_design','app_maya','Portfolio deep dive','video',1794637800000,1794641400000,'Asia/Kolkata',NULL,'https://meet.example.test/maya-portfolio','45 minutes with Daniel and Sofia. Walk through two projects and one decision you would change.','scheduled','usr_priya',1794520000000,1794614400000),
('int_lena_1','org_fieldnote','job_design','app_lena','Design craft interview','video',1794540000000,1794543600000,'Asia/Kolkata',NULL,'https://meet.example.test/lena-craft','60 minutes. Whiteboard-free conversation about two shipped projects.','completed','usr_priya',1794450000000,1794614400000),
('int_priyanka_1','org_fieldnote','job_engineer','app_priyanka','Pairing session','video',1794700000000,1794704400000,'Asia/Kolkata',NULL,'https://meet.example.test/priyanka-pair','60 minutes pairing on a small feature in TypeScript.','scheduled','usr_priya',1794540000000,1794614400000),
('int_omar_1','org_fieldnote','job_engineer','app_omar','Technical interview','video',1794510000000,1794513600000,'Asia/Kolkata',NULL,'https://meet.example.test/omar-tech','60 minutes. Data model and API design.','completed','usr_priya',1794420000000,1794614400000),
('int_grace_1','org_fieldnote','job_research','app_grace','Research ops interview','phone',1794440000000,1794441800000,'Asia/Kolkata',NULL,NULL,'30 minute call.','completed','usr_priya',1794420000000,1794614400000);

INSERT INTO interview_participants (id,organization_id,interview_id,user_id,role,created_at) VALUES
('ip_maya_daniel','org_fieldnote','int_maya_1','usr_daniel','lead',1794520000000),
('ip_maya_sofia','org_fieldnote','int_maya_1','usr_sofia','interviewer',1794520000000),
('ip_lena_daniel','org_fieldnote','int_lena_1','usr_daniel','lead',1794450000000),
('ip_lena_sofia','org_fieldnote','int_lena_1','usr_sofia','interviewer',1794450000000),
('ip_priyanka_daniel','org_fieldnote','int_priyanka_1','usr_daniel','lead',1794540000000),
('ip_priyanka_imran','org_fieldnote','int_priyanka_1','usr_imran','interviewer',1794540000000),
('ip_omar_daniel','org_fieldnote','int_omar_1','usr_daniel','lead',1794420000000),
('ip_omar_imran','org_fieldnote','int_omar_1','usr_imran','interviewer',1794420000000),
('ip_grace_priya','org_fieldnote','int_grace_1','usr_priya','lead',1794420000000);

INSERT INTO scorecards (id,organization_id,interview_id,application_id,interviewer_user_id,overall,summary,submitted_at,created_at) VALUES
('sc_lena_daniel','org_fieldnote','int_lena_1','app_lena','usr_daniel','strong_yes','Lena framed the research review problem precisely and showed a strong accessible interaction detail. Would want her in the debrief.',1794545000000,1794545000000),
('sc_lena_sofia','org_fieldnote','int_lena_1','app_lena','usr_sofia','yes','Good craft and good listening. Less direct experience with data-heavy interfaces than the brief asks, but she learns quickly.',1794546000000,1794546000000),
('sc_omar_daniel','org_fieldnote','int_omar_1','app_omar','usr_daniel','yes','Solid data modelling. Explained a migration safely and named the trade-offs. Assessment will tell us more about product sense.',1794515000000,1794515000000),
('sc_grace_priya','org_fieldnote','int_grace_1','app_grace','usr_priya','strong_yes','Grace has run participant recruitment at a similar scale and is careful with consent records. Clear communicator.',1794443000000,1794443000000);

INSERT INTO scorecard_responses (id,organization_id,scorecard_id,item_id,rating,evidence,created_at) VALUES
('sr_lena_d_1','org_fieldnote','sc_lena_daniel','sci_design_craft',4,'Showed the reading/editing split with the research behind it.',1794545000000),
('sr_lena_d_2','org_fieldnote','sc_lena_daniel','sci_design_judgement',5,'Started from observed behaviour, not a preferred solution.',1794545000000),
('sr_lena_d_3','org_fieldnote','sc_lena_daniel','sci_design_collab',4,'Described disagreeing with an engineer and changing the plan.',1794545000000),
('sr_lena_s_1','org_fieldnote','sc_lena_sofia','sci_design_craft',4,'Clean interaction detail in the second project.',1794546000000),
('sr_lena_s_2','org_fieldnote','sc_lena_sofia','sci_design_judgement',4,'Good framing, a little light on measurement.',1794546000000),
('sr_lena_s_3','org_fieldnote','sc_lena_sofia','sci_design_collab',4,'Direct and generous in the critique example.',1794546000000),
('sr_omar_d_1','org_fieldnote','sc_omar_daniel','sci_eng_depth',4,'Walked through a zero-downtime migration without prompting.',1794515000000),
('sr_omar_d_2','org_fieldnote','sc_omar_daniel','sci_eng_product',3,'Product examples were thinner than the engineering ones.',1794515000000),
('sr_omar_d_3','org_fieldnote','sc_omar_daniel','sci_eng_comms',4,'Clear, honest about what he did not know.',1794515000000),
('sr_grace_1','org_fieldnote','sc_grace_priya','sci_design_judgement',5,'Described a consent process she rebuilt after an audit finding.',1794443000000);

INSERT INTO feedback (id,organization_id,application_id,author_user_id,body,visibility,created_at) VALUES
('fb_lena_ananya','org_fieldnote','app_lena','usr_ananya','Debrief: both interviewers positive. Offer approved at the top of the band. Keep the start date flexible for her notice period.','hiring_team',1794560000000),
('fb_omar_daniel','org_fieldnote','app_omar','usr_daniel','Assessment is the deciding signal now. If the product sense is there, move to offer.','hiring_team',1794555000000),
('fb_maya_sofia','org_fieldnote','app_maya','usr_sofia','Portfolio is strong on research workflows. Ask about the handoff process in the deep dive.','hiring_team',1794525000000),
('fb_priyanka_imran','org_fieldnote','app_priyanka','usr_imran','Pairing session will tell us whether the platform depth is real.','hiring_team',1794545000000);

INSERT INTO communication_templates (id,organization_id,key,name,subject,body,created_at,updated_at) VALUES
('tpl_ack','org_fieldnote','acknowledgement','Application received','We have your application for {{job_title}}','Hi {{candidate_name}},\n\nThank you for applying for {{job_title}} at Fieldnote Labs. A person reads every application. We will reply within five working days, even if the answer is not yet.\n\nYou can check the status of your application any time using your private link.\n\nWarmly,\nPriya Nair\nTalent Partner, Fieldnote Labs',1794000000000,1794000000000),
('tpl_invite','org_fieldnote','interview_invitation','Interview invitation','Next step for {{job_title}}','Hi {{candidate_name}},\n\nWe would like to invite you to a {{interview_title}} for {{job_title}}.\n\nWhen: {{interview_time}}\nFormat: {{interview_format}}\n\nIf this time does not work, reply with two alternatives and we will adjust.\n\nWarmly,\nPriya Nair\nTalent Partner, Fieldnote Labs',1794000000000,1794000000000),
('tpl_reschedule','org_fieldnote','reschedule','Interview rescheduled','New time for your {{job_title}} interview','Hi {{candidate_name}},\n\nWe have moved your {{interview_title}} to {{interview_time}}. Everything else stays the same. Reply if this creates a problem.\n\nWarmly,\nPriya Nair\nTalent Partner, Fieldnote Labs',1794000000000,1794000000000),
('tpl_update','org_fieldnote','status_update','Status update','An update on your {{job_title}} application','Hi {{candidate_name}},\n\nA short update on your application for {{job_title}}: {{status_message}}\n\nWe will keep you posted. You can also see the current stage through your private link.\n\nWarmly,\nPriya Nair\nTalent Partner, Fieldnote Labs',1794000000000,1794000000000),
('tpl_offer','org_fieldnote','offer_followup','Offer follow-up','Your Fieldnote Labs offer','Hi {{candidate_name}},\n\nFollowing up on our offer for {{job_title}}. We are happy to answer any question about the role, the team, or the start date.\n\nWarmly,\nAnanya Rao\nFounder, Fieldnote Labs',1794000000000,1794000000000),
('tpl_close','org_fieldnote','closure','Application closure','Thank you for your interest in {{job_title}}','Hi {{candidate_name}},\n\nThank you for taking the time to apply for {{job_title}}. We are not moving forward with your application at this stage. This is a decision about the fit for one opening, not a judgement of your work.\n\nWe will keep your details for {{retention_days}} days unless you ask us to delete them.\n\nWarmly,\nPriya Nair\nTalent Partner, Fieldnote Labs',1794000000000,1794000000000);

INSERT INTO communication_events (id,organization_id,application_id,template_id,channel,to_email,subject,body,status,provider,provider_message_id,error,created_by_user_id,created_at,sent_at) VALUES
('com_ack_maya','org_fieldnote','app_maya','tpl_ack','email','maya.krishnan@example.test','We have your application for Senior Product Designer','Logged acknowledgement.','not_configured',NULL,NULL,'No email provider configured. Message saved to the application log.','usr_priya',1794311000000,NULL),
('com_ack_arjun','org_fieldnote','app_arjun','tpl_ack','email','arjun.mehta@example.test','We have your application for Senior Product Designer','Logged acknowledgement.','not_configured',NULL,NULL,'No email provider configured. Message saved to the application log.','usr_priya',1794316000000,NULL),
('com_invite_lena','org_fieldnote','app_lena','tpl_invite','email','lena.fischer@example.test','Next step for Senior Product Designer','Interview invitation for Design craft interview.','not_configured',NULL,NULL,'No email provider configured. Message saved to the application log.','usr_priya',1794451000000,NULL),
('com_invite_maya','org_fieldnote','app_maya','tpl_invite','email','maya.krishnan@example.test','Next step for Senior Product Designer','Interview invitation for Portfolio deep dive.','not_configured',NULL,NULL,'No email provider configured. Message saved to the application log.','usr_priya',1794521000000,NULL),
('com_close_ethan','org_fieldnote','app_ethan','tpl_close','email','ethan.brooks@example.test','Thank you for your interest in Research Operations Lead','Closure after screening.','not_configured',NULL,NULL,'No email provider configured. Message saved to the application log.','usr_priya',1794501000000,NULL),
('com_offer_grace','org_fieldnote','app_grace','tpl_offer','email','grace.okafor@example.test','Your Fieldnote Labs offer','Offer follow-up for Research Operations Lead.','not_configured',NULL,NULL,'No email provider configured. Message saved to the application log.','usr_priya',1794481000000,NULL);

INSERT INTO candidate_portal_tokens (id,organization_id,application_id,token_hash,expires_at,revoked_at,last_used_at,created_at) VALUES
('cpt_maya','org_fieldnote','app_maya','7d1c71527d1ff0e2f3008ece446344222cd013cef2cc60f3383a1885799b3f07',1797206400000,NULL,1794522000000,1794310000000),
('cpt_lena','org_fieldnote','app_lena','fd57619205474387a46b3f7ca6f694ada368d53c2bcdc64daaac6892398a08c4',1797206400000,NULL,NULL,1794320000000);

INSERT INTO retention_rules (id,organization_id,category,retention_days,created_at,updated_at) VALUES
('rr_apps','org_fieldnote','applications',365,1794000000000,1794000000000),
('rr_resumes','org_fieldnote','resumes',365,1794000000000,1794000000000),
('rr_audit','org_fieldnote','audit',730,1794000000000,1794000000000);

INSERT INTO deletion_requests (id,organization_id,application_id,request_type,status,note,requested_by,created_at,resolved_at,resolved_by_user_id,resolution_note) VALUES
('dr_ethan','org_fieldnote','app_ethan','delete','open','Please remove my application and resume from your records.','candidate',1794580000000,NULL,NULL,NULL);

INSERT INTO audit_events (id,organization_id,user_id,action,resource_type,resource_id,metadata_json,ip_address,created_at,prev_hash,row_hash) VALUES
('aud_seed_1','org_fieldnote','usr_priya','job.published','job','job_design','{"status":"published"}','127.0.0.1',1794300000000,NULL,'599902e89f90b2e9da2c0051b0a6153526e56c8654d8defc8d832f1eb378b81b'),
('aud_seed_2','org_fieldnote','usr_priya','application.stage_changed','application','app_maya','{"to":"Interview"}','127.0.0.1',1794520000000,'599902e89f90b2e9da2c0051b0a6153526e56c8654d8defc8d832f1eb378b81b','079adca2b9b5ce6d5b478ea4bc7526dca17fa378074b6ced42adbf95e9d99fcf'),
('aud_seed_3','org_fieldnote','usr_ananya','offer.approved','application','app_lena','{"stage":"Offer"}','127.0.0.1',1794570000000,'079adca2b9b5ce6d5b478ea4bc7526dca17fa378074b6ced42adbf95e9d99fcf','ebd27e6ee1ed30725e45b553de5b47c98f9a77557470e0aae440d95679dc6bb7');

INSERT INTO usage_limits (id,organization_id,metric,period,used,limit_value,updated_at) VALUES
('ul_active_jobs','org_fieldnote','active_jobs','2026-11',3,5,1794614400000),
('ul_seats','org_fieldnote','team_seats','2026-11',6,10,1794614400000),
('ul_apps','org_fieldnote','monthly_applications','2026-11',12,100,1794614400000);
