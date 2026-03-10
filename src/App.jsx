import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

const SK = { cases:"reg-cases-v3", templates:"reg-tpl-v3", settings:"reg-settings-v3" };
const API_MODEL = "claude-sonnet-4-20250514";

const CORE_FIELDS = [
  { key:"date",        label:"Date of Surgery",  type:"date",    required:true },
  { key:"cpt",         label:"CPT Code",         type:"text"   },
  { key:"approach",    label:"Approach",         type:"select",  options:["Laparoscopic","Robotic","Open","Hand-Assisted","Converted Lap→Open","Converted Robot→Open"] },
  { key:"asa",         label:"ASA Class",        type:"select",  options:["I","II","III","IV","V"] },
  { key:"setting",     label:"Setting",          type:"select",  options:["Elective","Urgent","Emergent"] },
  { key:"orTime",      label:"OR Time (min)",    type:"number" },
  { key:"ebl",         label:"EBL (mL)",         type:"number" },
  { key:"los",         label:"LOS (days)",       type:"number" },
  { key:"cost",        label:"Case Cost ($)",    type:"number" },
  { key:"clavien",     label:"Clavien-Dindo",    type:"select",  options:["None","I","II","IIIa","IIIb","IVa","IVb","V"] },
  { key:"readmit30",   label:"30d Readmission",  type:"boolean" },
  { key:"mortality30", label:"30d Mortality",    type:"boolean" },
  { key:"notes",       label:"Operative Notes",  type:"textarea" },
];

const DEFAULT_TEMPLATES = [
  {
    id:"hernia", name:"Hernia Repair", color:"#3b82f6", emoji:"🔵",
    patientName:"Hernia Surgery",
    patientDesc:"Surgery to repair a hernia — tissue or an organ pushing through a weak spot in muscle or tissue.",
    fields:[
      { key:"age",          label:"Age",                   type:"number" },
      { key:"bmi",          label:"BMI",                   type:"number" },
      { key:"dm",           label:"Diabetes",              type:"boolean" },
      { key:"smoker",       label:"Smoker",                type:"boolean" },
      { key:"herniaType",   label:"Hernia Type",           type:"select", options:["Inguinal — Right","Inguinal — Left","Inguinal — Bilateral","Umbilical","Epigastric","Ventral / Incisional","Parastomal","Hiatal","Paraesophageal","Spigelian","Lumbar","Other"] },
      { key:"primaryRecur", label:"Primary vs Recurrent",  type:"select", options:["Primary","Recurrent ×1","Recurrent ×2+"] },
      { key:"defectSize",   label:"Defect Size (cm)",      type:"number" },
      { key:"w3class",      label:"EHS Width Class",       type:"select", options:["W1 (<4 cm)","W2 (4–10 cm)","W3 (>10 cm)"] },
      { key:"meshUsed",     label:"Mesh Used",             type:"boolean" },
      { key:"meshType",     label:"Mesh Type",             type:"select", options:["Lightweight PP","Heavyweight PP","Biologic","Biosynthetic","PTFE / ePTFE","Composite","None — primary repair"] },
      { key:"meshSize",     label:"Mesh Size",             type:"text",   placeholder:"e.g. 15×10 cm" },
      { key:"meshPosition", label:"Mesh Position",         type:"select", options:["Onlay","Inlay","Sublay (retrorectus)","Preperitoneal (TEP/TAPP)","IPOM","IPOM+","TAR","rTAR (robotic)"] },
      { key:"compSep",      label:"Component Separation",  type:"select", options:["None","Anterior (ext. oblique)","Posterior (TAR)","Both"] },
      { key:"fixation",     label:"Mesh Fixation",         type:"select", options:["None","Absorbable tacks","Permanent tacks","Transfascial sutures","Fibrin glue","Hybrid"] },
      { key:"woundClass",   label:"Wound Class",           type:"select", options:["Clean","Clean-Contaminated","Contaminated","Dirty"] },
      { key:"ssi",          label:"SSI",                   type:"select", options:["None","Superficial","Deep","Organ/Space"] },
      { key:"seroma",       label:"Seroma",                type:"boolean" },
      { key:"hematoma",     label:"Hematoma",              type:"boolean" },
      { key:"reop",         label:"Reoperation",           type:"boolean" },
    ],
    followUpSchedule:["2 weeks","6 months","1 year","2 years","5 years","7 years","10 years"],
    followUpFields:[
      { key:"recurrence",    label:"Recurrence",           type:"boolean" },
      { key:"chronicPain",   label:"Chronic Pain",         type:"select", options:["None","Mild","Moderate","Severe"] },
      { key:"meshCompl",     label:"Mesh Complication",    type:"select", options:["None","Seroma","Infection","Rejection","Fistula","Erosion"] },
      { key:"meshRemoval",   label:"Mesh Removal",         type:"boolean" },
      { key:"reintervention",label:"Reintervention",       type:"boolean" },
      { key:"satisfaction",  label:"Patient Satisfaction", type:"select", options:["Excellent","Good","Fair","Poor"] },
      { key:"fuNotes",       label:"Notes",                type:"textarea" },
    ]
  },
  {
    id:"gerd", name:"GERD / Fundoplication", color:"#10b981", emoji:"🟢",
    patientName:"Reflux / Hiatal Hernia Surgery",
    patientDesc:"Surgery to treat acid reflux (GERD) or a hiatal hernia, often involving wrapping part of the stomach around the esophagus.",
    fields:[
      { key:"age",           label:"Age",                    type:"number" },
      { key:"bmi",           label:"BMI",                    type:"number" },
      { key:"dm",            label:"Diabetes",               type:"boolean" },
      { key:"smoker",        label:"Smoker",                 type:"boolean" },
      { key:"procedureType", label:"Procedure Type",         type:"select", options:["Nissen (360°)","Toupet (270°)","Dor (180°)","LINX Device","Hiatal Repair only","Paraesophageal Repair","Redo Fundoplication"] },
      { key:"hiatusSize",    label:"Hiatal Defect (cm)",     type:"number" },
      { key:"meshHiatus",    label:"Mesh at Hiatus",         type:"boolean" },
      { key:"preOpPPI",      label:"Pre-op on PPI",          type:"boolean" },
      { key:"preOpDeMeester",label:"DeMeester Score",        type:"number" },
      { key:"preOpManometry",label:"Pre-op Manometry",       type:"select", options:["Normal","Hypomotility","Absent peristalsis","Not done"] },
      { key:"dysphagia",     label:"Post-op Dysphagia",      type:"select", options:["None","Mild — self-resolving","Moderate — dilation needed","Severe — revision"] },
      { key:"gasBloat",      label:"Gas-Bloat Syndrome",     type:"select", options:["None","Mild","Moderate","Severe"] },
      { key:"chestPain",     label:"Post-op Chest Pain",     type:"boolean" },
      { key:"reop",          label:"Reoperation / Takedown", type:"boolean" },
    ],
    followUpSchedule:["2 weeks","3 months","6 months","1 year","2 years","5 years"],
    followUpFields:[
      { key:"recurrence",    label:"Radiologic Recurrence",  type:"boolean" },
      { key:"symptomatic",   label:"Symptomatic Recurrence", type:"boolean" },
      { key:"onPPI",         label:"Still on PPI / Antacids",type:"boolean" },
      { key:"dysphagia",     label:"Dysphagia",              type:"select", options:["None","Mild","Moderate","Severe"] },
      { key:"gasBloat",      label:"Gas Bloat",              type:"select", options:["None","Mild","Moderate","Severe"] },
      { key:"dilation",      label:"Dilation Required",      type:"boolean" },
      { key:"satisfaction",  label:"Patient Satisfaction",   type:"select", options:["Excellent","Good","Fair","Poor"] },
      { key:"fuNotes",       label:"Notes",                  type:"textarea" },
    ]
  },
  {
    id:"skinsoft", name:"Skin & Soft Tissue", color:"#f59e0b", emoji:"🟡",
    patientName:"Skin & Soft Tissue Surgery",
    patientDesc:"Removal or treatment of skin lesions, lumps, cysts, lipomas, or other soft tissue masses.",
    fields:[
      { key:"age",          label:"Age",                    type:"number" },
      { key:"bmi",          label:"BMI",                    type:"number" },
      { key:"dm",           label:"Diabetes",               type:"boolean" },
      { key:"smoker",       label:"Smoker",                 type:"boolean" },
      { key:"lesionType",   label:"Lesion Type",            type:"select", options:["Sebaceous cyst","Lipoma","Pilonidal cyst","Pilonidal sinus","Hidradenitis suppurativa","Soft tissue mass — benign","Soft tissue sarcoma","Skin cancer — BCC","Skin cancer — SCC","Melanoma","Merkel cell","Other"] },
      { key:"location",     label:"Location",               type:"text",   placeholder:"e.g. left posterior neck" },
      { key:"size",         label:"Size (cm)",              type:"number" },
      { key:"margins",      label:"Surgical Margins",       type:"select", options:["R0 — clear","R1 — microscopic","R2 — macroscopic","N/A — benign"] },
      { key:"reconstruction",label:"Reconstruction",        type:"select", options:["Primary closure","Skin graft","Local flap","Regional flap","Free flap","None — open"] },
      { key:"woundClass",   label:"Wound Class",            type:"select", options:["Clean","Clean-Contaminated","Contaminated","Dirty"] },
      { key:"sentinelNode", label:"Sentinel Node Biopsy",   type:"boolean" },
      { key:"ssi",          label:"SSI / Wound Complication",type:"select", options:["None","Superficial","Dehiscence","Seroma","Hematoma","Deep infection"] },
      { key:"reop",         label:"Reoperation",            type:"boolean" },
    ],
    followUpSchedule:["2 weeks","3 months","1 year","3 years","5 years"],
    followUpFields:[
      { key:"recurrence",   label:"Local Recurrence",       type:"boolean" },
      { key:"metastasis",   label:"Distant Metastasis",     type:"boolean" },
      { key:"woundHealing", label:"Wound Healed Completely",type:"boolean" },
      { key:"satisfaction", label:"Patient Satisfaction",   type:"select", options:["Excellent","Good","Fair","Poor"] },
      { key:"fuNotes",      label:"Notes",                  type:"textarea" },
    ]
  },
  {
    id:"ports", name:"Port Placement / Access", color:"#8b5cf6", emoji:"🟣",
    patientName:"Port / IV Access Placement",
    patientDesc:"Surgical placement of a port or catheter for long-term IV access, typically for chemotherapy or other ongoing treatments.",
    fields:[
      { key:"age",          label:"Age",                    type:"number" },
      { key:"bmi",          label:"BMI",                    type:"number" },
      { key:"dm",           label:"Diabetes",               type:"boolean" },
      { key:"indication",   label:"Indication",             type:"select", options:["Chemotherapy","TPN / long-term nutrition","Frequent blood draws","IV antibiotics","Dialysis access","Hemodialysis — tunneled","Other"] },
      { key:"deviceType",   label:"Device Type",            type:"select", options:["Port-a-Cath — chest","Port-a-Cath — arm (PICC port)","Tunneled PICC","Hickman / Broviac","Mediport","Permcath (HD)","PICC line","Other"] },
      { key:"side",         label:"Side",                   type:"select", options:["Right","Left","N/A"] },
      { key:"veinAccess",   label:"Vein Access",            type:"select", options:["Subclavian","Internal jugular","Axillary","Cephalic cut-down","Femoral","Other"] },
      { key:"imagingUsed",  label:"Ultrasound / Fluoro Used",type:"boolean" },
      { key:"pneumothorax", label:"Pneumothorax",           type:"boolean" },
      { key:"malposition",  label:"Malposition",            type:"boolean" },
      { key:"hematoma",     label:"Hematoma",               type:"boolean" },
      { key:"infxn",        label:"Device Infection",       type:"boolean" },
      { key:"removal",      label:"Device Removed Early",   type:"boolean" },
    ],
    followUpSchedule:["2 weeks","device removal"],
    followUpFields:[
      { key:"infxnFU",      label:"Infection at Follow-up", type:"boolean" },
      { key:"occlusion",    label:"Occlusion / Fibrin sheath",type:"boolean" },
      { key:"stillFunctional",label:"Device Still Functional",type:"boolean" },
      { key:"fuNotes",      label:"Notes",                  type:"textarea" },
    ]
  },
  {
    id:"chole", name:"Cholecystectomy", color:"#ec4899", emoji:"🩷",
    patientName:"Gallbladder Surgery",
    patientDesc:"Removal of the gallbladder, most commonly for gallstones or gallbladder inflammation.",
    fields:[
      { key:"age",          label:"Age",                    type:"number" },
      { key:"bmi",          label:"BMI",                    type:"number" },
      { key:"dm",           label:"Diabetes",               type:"boolean" },
      { key:"smoker",       label:"Smoker",                 type:"boolean" },
      { key:"indication",   label:"Indication",             type:"select", options:["Symptomatic cholelithiasis","Acute cholecystitis","Gangrenous cholecystitis","Choledocholithiasis","Gallstone pancreatitis","Biliary dyskinesia","Polyp","Acalculous cholecystitis","Other"] },
      { key:"acuteGrade",   label:"Tokyo Grade (if acute)", type:"select", options:["N/A","Grade I (mild)","Grade II (moderate)","Grade III (severe)"] },
      { key:"cbd",          label:"CBD Explored",           type:"boolean" },
      { key:"ioc",          label:"Intraop Cholangiogram",  type:"boolean" },
      { key:"critView",     label:"Critical View of Safety",type:"select", options:["Achieved","Not achieved — subtotal","Not achieved — converted"] },
      { key:"subtotal",     label:"Subtotal Cholecystectomy",type:"boolean" },
      { key:"bileLeak",     label:"Bile Leak",              type:"select", options:["None","Grade A (conservative)","Grade B (ERCP/drain)","Grade C (reoperation)"] },
      { key:"biliaryInjury",label:"Biliary Injury",         type:"select", options:["None","Minor (cystic duct)","Major — E1","Major — E2","Major — E3","Major — E4","Major — E5"] },
      { key:"ssi",          label:"SSI",                    type:"select", options:["None","Superficial","Deep","Organ/Space"] },
      { key:"reop",         label:"Reoperation / ERCP",     type:"boolean" },
    ],
    followUpSchedule:["2 weeks","6 months"],
    followUpFields:[
      { key:"biliary",      label:"Biliary Complication",   type:"boolean" },
      { key:"postchole",    label:"Post-chole Syndrome",    type:"boolean" },
      { key:"satisfaction", label:"Patient Satisfaction",   type:"select", options:["Excellent","Good","Fair","Poor"] },
      { key:"fuNotes",      label:"Notes",                  type:"textarea" },
    ]
  },
  {
    id:"appy", name:"Appendectomy", color:"#f97316", emoji:"🟠",
    patientName:"Appendix Surgery",
    patientDesc:"Removal of the appendix, most commonly for appendicitis.",
    fields:[
      { key:"age",          label:"Age",                    type:"number" },
      { key:"bmi",          label:"BMI",                    type:"number" },
      { key:"dm",           label:"Diabetes",               type:"boolean" },
      { key:"smoker",       label:"Smoker",                 type:"boolean" },
      { key:"presentation", label:"Presentation",           type:"select", options:["Uncomplicated appendicitis","Perforated — abscess","Perforated — free perforation","Phlegmon","Incidental / normal appendix","Appendiceal mass / tumor","Other"] },
      { key:"alvarado",     label:"Alvarado Score",         type:"number" },
      { key:"drainPlaced",  label:"Drain Placed",           type:"boolean" },
      { key:"stump",        label:"Stump Closure",          type:"select", options:["Endoloop","Stapler","Hand-sewn","N/A"] },
      { key:"pathology",    label:"Final Pathology",        type:"select", options:["Acute appendicitis","Perforated appendicitis","Negative appendix","Carcinoid / NET","Appendiceal adenocarcinoma","Mucinous neoplasm (LAMN/HAMN)","Other"] },
      { key:"ssi",          label:"SSI",                    type:"select", options:["None","Superficial","Deep","Organ/Space (abscess)"] },
      { key:"ileus",        label:"Prolonged Ileus",        type:"boolean" },
      { key:"reop",         label:"Reoperation",            type:"boolean" },
    ],
    followUpSchedule:["2 weeks","6 months"],
    followUpFields:[
      { key:"woundHealed",  label:"Wound Fully Healed",     type:"boolean" },
      { key:"stumpBlowout", label:"Stump Complication",     type:"boolean" },
      { key:"satisfaction", label:"Patient Satisfaction",   type:"select", options:["Excellent","Good","Fair","Poor"] },
      { key:"fuNotes",      label:"Notes",                  type:"textarea" },
    ]
  },
];

const DEFAULT_SETTINGS = {
  surgeonName: "General Surgery",
  practiceName: "",
  tagline: "Transparent, data-driven surgical care.",
  colleaguePassword: "surgeon2024",
  hospitalPassword: "admin2024",
  // per-view toggles
  patient: {
    showVolume: true, showComplications: true, showLOS: true,
    showCost: false, showConversion: true, showReadmission: true,
    showSatisfaction: true, showNSQIP: false,
    introText: "The data below reflects my personal outcomes from cases I have personally performed. All information is de-identified — no patient names or identifying details are shown. I believe transparency builds trust."
  },
  colleague: {
    showVolume: true, showComplications: true, showLOS: true,
    showCost: true, showConversion: true, showReadmission: true,
    showMortality: true, showNSQIP: true, showClavien: true,
    showSSI: true, showApproach: true,
  },
  hospital: {
    showCost: true, showLOS: true, showORTime: true,
    showReadmission: true, showMortality: true, showVolume: true,
    showConversion: true,
  }
};

// ─── NSQIP approximate benchmarks ─────────────────────────────────────────────
const NSQIP = {
  hernia:   { complications:8.2,  ssi:2.1, conversion:3.1, mortality:0.1,  los:1.4,  avgCost:12000 },
  gerd:     { complications:6.4,  ssi:0.8, conversion:4.2, mortality:0.05, los:1.8,  avgCost:14000 },
  skinsoft: { complications:5.1,  ssi:3.2, conversion:0,   mortality:0.02, los:0.5,  avgCost:4000  },
  ports:    { complications:3.8,  ssi:1.1, conversion:1.0, mortality:0.01, los:0.2,  avgCost:3500  },
  chole:    { complications:4.1,  ssi:0.9, conversion:5.2, mortality:0.1,  los:1.1,  avgCost:8400  },
  appy:     { complications:7.3,  ssi:3.4, conversion:3.8, mortality:0.1,  los:1.8,  avgCost:7200  },
};

// ─── Sample cases ──────────────────────────────────────────────────────────────
const SAMPLE_CASES = [
  { id:"OP-001", templateId:"chole",    templateName:"Cholecystectomy",      core:{ date:"2025-10-12", cpt:"47562", approach:"Laparoscopic",       asa:"II",  setting:"Elective",  orTime:48,  ebl:10,  los:1, cost:8100,  clavien:"None", readmit30:false, mortality30:false, notes:"Routine. Critical view achieved." },                                          custom:{ age:54, bmi:28, dm:false, smoker:false, indication:"Symptomatic cholelithiasis", critView:"Achieved", ioc:false, bileLeak:"None", biliaryInjury:"None", ssi:"None", reop:false }, followUps:[] },
  { id:"OP-002", templateId:"hernia",   templateName:"Hernia Repair",        core:{ date:"2025-10-22", cpt:"49650", approach:"Laparoscopic",       asa:"I",   setting:"Elective",  orTime:65,  ebl:15,  los:0, cost:7400,  clavien:"None", readmit30:false, mortality30:false, notes:"Bilateral TEP. Mesh 15×10 placed bilateral." },                             custom:{ age:42, bmi:26, dm:false, smoker:false, herniaType:"Inguinal — Bilateral", primaryRecur:"Primary", meshUsed:true, meshType:"Lightweight PP", meshPosition:"Preperitoneal (TEP/TAPP)", meshSize:"15×10", compSep:"None", ssi:"None", seroma:false, reop:false }, followUps:[{ id:"fu1", timepoint:"2 weeks", date:"2025-11-05", fields:{ recurrence:false, chronicPain:"None", satisfaction:"Excellent", fuNotes:"Healing well." }}] },
  { id:"OP-003", templateId:"hernia",   templateName:"Hernia Repair",        core:{ date:"2025-11-05", cpt:"49560", approach:"Robotic",            asa:"II",  setting:"Elective",  orTime:185, ebl:50,  los:2, cost:19200, clavien:"I",    readmit30:false, mortality30:false, notes:"TAR technique. Large defect. 30×20 mesh." },                                custom:{ age:61, bmi:34, dm:true,  smoker:false, herniaType:"Ventral / Incisional", primaryRecur:"Recurrent ×1", defectSize:12, w3class:"W3 (>10 cm)", meshUsed:true, meshType:"Lightweight PP", meshPosition:"rTAR (robotic)", meshSize:"30×20", compSep:"Posterior (TAR)", ssi:"None", seroma:true, reop:false }, followUps:[] },
  { id:"OP-004", templateId:"appy",     templateName:"Appendectomy",         core:{ date:"2025-11-14", cpt:"44970", approach:"Laparoscopic",       asa:"II",  setting:"Urgent",    orTime:38,  ebl:10,  los:1, cost:6700,  clavien:"None", readmit30:false, mortality30:false, notes:"Perforated. Drain placed. Washout." },                                      custom:{ age:28, bmi:23, dm:false, smoker:false, presentation:"Perforated — free perforation", drainPlaced:true, stump:"Stapler", pathology:"Perforated appendicitis", ssi:"None", ileus:false, reop:false }, followUps:[] },
  { id:"OP-005", templateId:"gerd",     templateName:"GERD / Fundoplication",core:{ date:"2025-11-25", cpt:"43280", approach:"Laparoscopic",       asa:"II",  setting:"Elective",  orTime:92,  ebl:25,  los:1, cost:12800, clavien:"None", readmit30:false, mortality30:false, notes:"Nissen. 3cm hiatal defect closed primarily." },                            custom:{ age:48, bmi:29, dm:false, smoker:false, procedureType:"Nissen (360°)", hiatusSize:3, meshHiatus:false, preOpPPI:true, dysphagia:"None", gasBloat:"Mild", reop:false }, followUps:[] },
  { id:"OP-006", templateId:"ports",    templateName:"Port Placement / Access",core:{ date:"2025-12-03", cpt:"36561", approach:"Open",             asa:"II",  setting:"Elective",  orTime:22,  ebl:5,   los:0, cost:3200,  clavien:"None", readmit30:false, mortality30:false, notes:"Right subclavian. US guided. Confirmed by CXR." },                          custom:{ age:67, bmi:24, dm:false, indication:"Chemotherapy", deviceType:"Port-a-Cath — chest", side:"Right", veinAccess:"Subclavian", imagingUsed:true, pneumothorax:false, malposition:false, hematoma:false, infxn:false, removal:false }, followUps:[] },
  { id:"OP-007", templateId:"chole",    templateName:"Cholecystectomy",      core:{ date:"2025-12-10", cpt:"47562", approach:"Converted Lap→Open", asa:"III", setting:"Urgent",    orTime:115, ebl:110, los:3, cost:13100, clavien:"IIIa", readmit30:false, mortality30:false, notes:"Severe Calot inflammation. Converted. IOC normal. ERCP POD 3." },           custom:{ age:71, bmi:31, dm:true,  smoker:false, indication:"Gangrenous cholecystitis", acuteGrade:"Grade III (severe)", ioc:true, critView:"Not achieved — converted", bileLeak:"Grade B (ERCP/drain)", biliaryInjury:"None", ssi:"None", reop:true }, followUps:[] },
  { id:"OP-008", templateId:"skinsoft", templateName:"Skin & Soft Tissue",   core:{ date:"2025-12-18", cpt:"27615", approach:"Open",               asa:"II",  setting:"Elective",  orTime:55,  ebl:30,  los:0, cost:4800,  clavien:"None", readmit30:false, mortality30:false, notes:"Wide local excision. 2cm margins. Primary closure." },                      custom:{ age:55, bmi:27, dm:false, smoker:true,  lesionType:"Melanoma", location:"Right posterior thigh", size:1.8, margins:"R0 — clear", reconstruction:"Primary closure", sentinelNode:true, ssi:"None", reop:false }, followUps:[] },
  { id:"OP-009", templateId:"hernia",   templateName:"Hernia Repair",        core:{ date:"2026-01-08", cpt:"49505", approach:"Open",               asa:"I",   setting:"Elective",  orTime:55,  ebl:20,  los:0, cost:6900,  clavien:"None", readmit30:false, mortality30:false, notes:"Right inguinal. Lichtenstein repair." },                                    custom:{ age:38, bmi:24, dm:false, smoker:false, herniaType:"Inguinal — Right", primaryRecur:"Primary", meshUsed:true, meshType:"Lightweight PP", meshPosition:"Onlay", compSep:"None", ssi:"None", seroma:false, reop:false }, followUps:[] },
  { id:"OP-010", templateId:"chole",    templateName:"Cholecystectomy",      core:{ date:"2026-01-15", cpt:"47562", approach:"Laparoscopic",       asa:"I",   setting:"Elective",  orTime:44,  ebl:5,   los:0, cost:7800,  clavien:"None", readmit30:false, mortality30:false, notes:"Day case. Straightforward." },                                              custom:{ age:36, bmi:22, dm:false, smoker:false, indication:"Symptomatic cholelithiasis", critView:"Achieved", ioc:false, bileLeak:"None", biliaryInjury:"None", ssi:"None", reop:false }, followUps:[] },
  { id:"OP-011", templateId:"appy",     templateName:"Appendectomy",         core:{ date:"2026-01-22", cpt:"44970", approach:"Laparoscopic",       asa:"II",  setting:"Urgent",    orTime:35,  ebl:5,   los:1, cost:6500,  clavien:"None", readmit30:false, mortality30:false, notes:"Uncomplicated. Endoloop. Standard." },                                      custom:{ age:19, bmi:21, dm:false, smoker:false, presentation:"Uncomplicated appendicitis", drainPlaced:false, stump:"Endoloop", pathology:"Acute appendicitis", ssi:"None", ileus:false, reop:false }, followUps:[] },
  { id:"OP-012", templateId:"hernia",   templateName:"Hernia Repair",        core:{ date:"2026-02-04", cpt:"49560", approach:"Laparoscopic",       asa:"II",  setting:"Elective",  orTime:142, ebl:40,  los:1, cost:14200, clavien:"None", readmit30:false, mortality30:false, notes:"Umbilical + small epigastric. IPOM+. Two defects." },                       custom:{ age:50, bmi:30, dm:false, smoker:false, herniaType:"Umbilical", primaryRecur:"Primary", defectSize:3, w3class:"W1 (<4 cm)", meshUsed:true, meshType:"Composite", meshPosition:"IPOM+", compSep:"None", fixation:"Transfascial sutures", ssi:"None", seroma:false, reop:false }, followUps:[] },
  { id:"OP-013", templateId:"gerd",     templateName:"GERD / Fundoplication",core:{ date:"2026-02-12", cpt:"43281", approach:"Laparoscopic",       asa:"II",  setting:"Elective",  orTime:145, ebl:30,  los:2, cost:16400, clavien:"None", readmit30:false, mortality30:false, notes:"Large PEH. Mesh at hiatus. Toupet wrap." },                                 custom:{ age:72, bmi:27, dm:false, smoker:false, procedureType:"Paraesophageal Repair", hiatusSize:8, meshHiatus:true, preOpPPI:true, dysphagia:"Mild — self-resolving", gasBloat:"None", reop:false }, followUps:[] },
  { id:"OP-014", templateId:"ports",    templateName:"Port Placement / Access",core:{ date:"2026-02-18", cpt:"36561", approach:"Open",             asa:"III", setting:"Elective",  orTime:28,  ebl:5,   los:0, cost:3400,  clavien:"None", readmit30:false, mortality30:false, notes:"Left IJ approach. US + fluoro. Good flow." },                               custom:{ age:58, bmi:26, dm:true,  indication:"Chemotherapy", deviceType:"Port-a-Cath — chest", side:"Left", veinAccess:"Internal jugular", imagingUsed:true, pneumothorax:false, malposition:false, hematoma:false, infxn:false, removal:false }, followUps:[] },
  { id:"OP-015", templateId:"chole",    templateName:"Cholecystectomy",      core:{ date:"2026-02-25", cpt:"47562", approach:"Laparoscopic",       asa:"II",  setting:"Elective",  orTime:51,  ebl:10,  los:1, cost:8200,  clavien:"None", readmit30:false, mortality30:false, notes:"Mild adhesions. Critical view achieved." },                                 custom:{ age:49, bmi:29, dm:false, smoker:false, indication:"Symptomatic cholelithiasis", critView:"Achieved", ioc:false, bileLeak:"None", biliaryInjury:"None", ssi:"None", reop:false }, followUps:[] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2,9);
const avg  = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
const pct  = (n,d) => d ? ((n/d)*100).toFixed(1) : "0.0";
const dollar = n => !n||n===0 ? "—" : n>=1000 ? `$${(n/1000).toFixed(1)}k` : `$${n}`;
const fmtD = v => v ? new Date(v+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"}) : "—";
const CD_COL = { None:"#10b981",I:"#84cc16",II:"#f59e0b",IIIa:"#f97316",IIIb:"#ef4444",IVa:"#dc2626",IVb:"#b91c1c",V:"#7f1d1d" };

async function callClaude(sys, user) {
  const r = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ model:API_MODEL, max_tokens:2000, system:sys, messages:[{role:"user",content:user}] })
  });
  const d = await r.json();
  return d.content?.[0]?.text||"";
}

// ─── Field Input ──────────────────────────────────────────────────────────────
function FieldInput({ field, value, onChange, compact=false }) {
  const s = { width:"100%", padding:compact?"6px 8px":"9px 10px", background:"#070d1a", border:"1px solid #1e293b", borderRadius:8, color:"#cbd5e1", fontSize:compact?12:13, fontFamily:"inherit" };
  if (field.type==="select") return (
    <select value={value??""} onChange={e=>onChange(e.target.value)} style={s}>
      <option value="">—</option>
      {(field.options||[]).map(o=><option key={o}>{o}</option>)}
    </select>
  );
  if (field.type==="boolean") return (
    <div style={{display:"flex",gap:6,marginTop:4}}>
      {["Yes","No"].map(o=>(
        <button key={o} onClick={()=>onChange(o==="Yes")} style={{padding:"5px 12px",borderRadius:6,border:"1px solid",fontSize:12,cursor:"pointer",fontFamily:"inherit",
          borderColor:(o==="Yes"?value===true:value===false)?"#2563eb":"#1e293b",
          background:(o==="Yes"?value===true:value===false)?"#1e3a5f":"transparent",
          color:(o==="Yes"?value===true:value===false)?"#93c5fd":"#475569"}}>{o}</button>
      ))}
    </div>
  );
  if (field.type==="textarea") return <textarea value={value??""} onChange={e=>onChange(e.target.value)} rows={compact?2:3} style={{...s,resize:"vertical"}} />;
  return <input type={field.type==="number"?"number":"text"} value={value??""} onChange={e=>onChange(field.type==="number"?(e.target.value===""?"":Number(e.target.value)):e.target.value)} placeholder={field.placeholder||""} style={s} />;
}

function renderVal(field, value) {
  if (value===undefined||value===null||value==="") return <span style={{color:"#1e3a5f"}}>—</span>;
  if (field.type==="boolean") return value ? <span style={{color:"#10b981",fontSize:11,fontWeight:600}}>✓ Yes</span> : <span style={{color:"#334155",fontSize:11}}>No</span>;
  return <span style={{fontSize:12.5,color:"#94a3b8"}}>{String(value)}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATIENT VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function PatientView({ settings, cases, templates, statsFor, getTpl }) {
  const [selTpl, setSelTpl] = useState(null);
  const sv = settings.patient || {};
  const tplsWithCases = templates.filter(t => cases.some(c => c.templateId === t.id));
  const viewCases = selTpl ? cases.filter(c => c.templateId === selTpl) : cases;
  const s = statsFor(viewCases);
  const tplObj = selTpl ? getTpl(selTpl) : null;

  const satCounts = {Excellent:0, Good:0, Fair:0, Poor:0};
  viewCases.forEach(c => (c.followUps||[]).forEach(fu => {
    if(fu.fields.satisfaction) satCounts[fu.fields.satisfaction] = (satCounts[fu.fields.satisfaction]||0)+1;
  }));
  const totalSat = Object.values(satCounts).reduce((a,b)=>a+b,0);

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      {/* Hero */}
      <div style={{background:"linear-gradient(135deg,#1d4ed8,#2563eb)",border:"1px solid #93c5fd",borderRadius:16,padding:"32px 36px",marginBottom:24,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-20,top:-20,width:160,height:160,borderRadius:"50%",background:"#ffffff",opacity:0.08}} />
        <div style={{fontSize:10,color:"#bfdbfe",letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:8}}>Surgeon Outcomes · General Surgery</div>
        <div style={{fontSize:28,fontWeight:700,color:"#ffffff",letterSpacing:"-0.02em",marginBottom:10}}>{settings.surgeonName||"Surgical Outcomes"}</div>
        {sv.introText&&<div style={{fontSize:13,color:"#dbeafe",maxWidth:620,lineHeight:1.7,marginBottom:16}}>{sv.introText}</div>}
        <div style={{display:"flex",gap:28}}>
          {[[cases.length,"Cases Performed"],[tplsWithCases.length,"Procedure Types"],["ACS","Member"]].map(([v,l])=>(
            <div key={l}><div style={{fontSize:10,color:"#bfdbfe",textTransform:"uppercase",letterSpacing:"0.12em"}}>{l}</div><div style={{fontSize:22,fontWeight:700,color:"#ffffff",fontFamily:"'JetBrains Mono',monospace"}}>{v}</div></div>
          ))}
        </div>
      </div>

      {/* Procedure picker */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
        <button onClick={()=>setSelTpl(null)} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${!selTpl?"#1d4ed8":"#cbd5e1"}`,background:!selTpl?"#1d4ed8":"#ffffff",color:!selTpl?"#ffffff":"#64748b",fontSize:13,fontWeight:!selTpl?600:400,cursor:"pointer"}}>All Procedures</button>
        {tplsWithCases.map(t=>(
          <button key={t.id} onClick={()=>setSelTpl(t.id)} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${selTpl===t.id?t.color:"#cbd5e1"}`,background:selTpl===t.id?t.color+"22":"#ffffff",color:selTpl===t.id?t.color:"#64748b",fontSize:13,fontWeight:selTpl===t.id?600:400,cursor:"pointer"}}>
            {t.emoji} {t.patientName||t.name}
          </button>
        ))}
      </div>

      {tplObj?.patientDesc&&<div style={{fontSize:13,color:"#475569",lineHeight:1.7,marginBottom:20,padding:"14px 18px",background:"#f0f9ff",borderRadius:10,border:"1px solid #bae6fd"}}>{tplObj.patientDesc}</div>}

      {/* KPIs row 1 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {sv.showVolume&&<div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,padding:"18px 22px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}><div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Cases Performed</div><div style={{fontSize:32,fontWeight:700,color:"#1e293b",fontFamily:"'JetBrains Mono',monospace"}}>{s.n}</div><div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>{selTpl?`${tplObj?.patientName||tplObj?.name} procedures`:"across all procedure types"}</div></div>}
        {sv.showComplications&&<div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,padding:"18px 22px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}><div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Complication Rate</div><div style={{fontSize:32,fontWeight:700,color:s.compPct>10?"#f59e0b":"#10b981",fontFamily:"'JetBrains Mono',monospace"}}>{pct(s.comps.length,s.n)}%</div><div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Any complication requiring attention</div></div>}
        {sv.showReadmission&&<div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,padding:"18px 22px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}><div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>30-Day Readmission</div><div style={{fontSize:32,fontWeight:700,color:s.readmitPct>8?"#f97316":"#10b981",fontFamily:"'JetBrains Mono',monospace"}}>{pct(s.readmits.length,s.n)}%</div><div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Unplanned return to hospital</div></div>}
      </div>

      {/* KPIs row 2 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {sv.showLOS&&s.avgLOS>0&&<div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,padding:"18px 22px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}><div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Average Hospital Stay</div><div style={{fontSize:28,fontWeight:700,color:"#1e293b",fontFamily:"'JetBrains Mono',monospace"}}>{s.avgLOS.toFixed(1)} days</div></div>}
        {sv.showConversion&&<div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,padding:"18px 22px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}><div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Minimally Invasive Rate</div><div style={{fontSize:28,fontWeight:700,color:"#0284c7",fontFamily:"'JetBrains Mono',monospace"}}>{pct(s.mis.length,s.n)}%</div><div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Laparoscopic or robotic approach</div></div>}
        {sv.showCost&&s.avgCost>0&&<div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,padding:"18px 22px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}><div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Average Case Cost</div><div style={{fontSize:28,fontWeight:700,color:"#16a34a",fontFamily:"'JetBrains Mono',monospace"}}>{dollar(Math.round(s.avgCost))}</div><div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Facility-level cost data</div></div>}
      </div>

      {/* Satisfaction */}
      {sv.showSatisfaction&&totalSat>0&&(
        <div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,padding:"18px 22px",marginBottom:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:13,fontWeight:600,color:"#1e293b",marginBottom:14}}>Patient Satisfaction (from follow-up data)</div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            {Object.entries(satCounts).filter(([,v])=>v>0).map(([k,v])=>{
              const col=k==="Excellent"?"#10b981":k==="Good"?"#84cc16":k==="Fair"?"#f59e0b":"#ef4444";
              return <div key={k} style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:32,height:32,borderRadius:8,background:col+"22",border:`1px solid ${col}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:col}}>{Math.round(v/totalSat*100)}%</div><span style={{fontSize:12,color:"#64748b"}}>{k}</span></div>;
            })}
            <div style={{fontSize:11,color:"#94a3b8",alignSelf:"center"}}>Based on {totalSat} follow-up responses</div>
          </div>
        </div>
      )}

      {/* Volume by procedure */}
      {!selTpl&&sv.showVolume&&(
        <div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,padding:"18px 22px",marginBottom:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:13,fontWeight:600,color:"#1e293b",marginBottom:14}}>Experience by Procedure Type</div>
          {tplsWithCases.map(t=>{
            const cnt=cases.filter(c=>c.templateId===t.id).length;
            return (
              <div key={t.id} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:12.5,color:"#475569"}}>{t.emoji} {t.patientName||t.name}</span>
                  <span style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:t.color}}>{cnt} cases</span>
                </div>
                <div style={{height:8,background:"#f1f5f9",borderRadius:4}}><div style={{width:`${(cnt/cases.length)*100}%`,height:"100%",background:t.color,borderRadius:4,opacity:0.8}} /></div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"14px 18px",fontSize:11,color:"#64748b",lineHeight:1.7}}>
        <strong style={{color:"#475569"}}>About this data:</strong> All figures are self-reported and de-identified. Complication rates reflect my personal logged experience and should be understood in context of each patient's individual risk factors and case complexity. This information is provided to support informed consent and shared decision-making — not as a guarantee of outcome. For questions, please speak with me directly.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function SurgicalRegistry() {
  const [cases,     setCases]     = useState([]);
  const [templates, setTemplates] = useState([]);
  const [settings,  setSettings]  = useState(DEFAULT_SETTINGS);
  const [loaded,    setLoaded]    = useState(false);
  const [page,      setPage]      = useState("registry"); // registry|new|detail|templates|dashboard|dictate|settings|patient|colleague|hospital
  const [saved,     setSaved]     = useState("");

  const [newCase,   setNewCase]   = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [detailId,  setDetailId]  = useState(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [newFU,     setNewFU]     = useState(null);

  const [filterTpl, setFilterTpl] = useState("all");
  const [search,    setSearch]    = useState("");
  const [advFilters,setAdvFilters]= useState([]);
  const [showAF,    setShowAF]    = useState(false);
  const [newAF,     setNewAF]     = useState({field:"",op:"=",value:""});

  const [tplEditId, setTplEditId] = useState(null);
  const [tplTab,    setTplTab]    = useState("list");

  const [dictText,  setDictText]  = useState("");
  const [dictLoading,setDictLoading]=useState(false);
  const [dictError, setDictError] = useState("");
  const [dictResult,setDictResult]= useState(null);
  const [isListening,setIsListening]=useState(false);
  const recRef = useRef(null);

  const [pwInput,   setPwInput]   = useState("");
  const [pwError,   setPwError]   = useState("");
  const [pwTarget,  setPwTarget]  = useState(null); // "colleague"|"hospital"

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    (async()=>{
      try {
        const [cr,tr,sr] = await Promise.all([window.storage.get(SK.cases),window.storage.get(SK.templates),window.storage.get(SK.settings)]);
        setCases(cr?.value?JSON.parse(cr.value):SAMPLE_CASES);
        setTemplates(tr?.value?JSON.parse(tr.value):DEFAULT_TEMPLATES);
        setSettings(sr?.value?{...DEFAULT_SETTINGS,...JSON.parse(sr.value)}:DEFAULT_SETTINGS);
      } catch { setCases(SAMPLE_CASES); setTemplates(DEFAULT_TEMPLATES); }
      setLoaded(true);
    })();
  },[]);

  const persistCases = useCallback(async d=>{
    try { await window.storage.set(SK.cases,JSON.stringify(d)); setSaved("Saved ✓"); setTimeout(()=>setSaved(""),2000); } catch {}
  },[]);
  const persistTemplates = useCallback(async d=>{ try { await window.storage.set(SK.templates,JSON.stringify(d)); } catch {} },[]);
  const persistSettings  = useCallback(async d=>{ try { await window.storage.set(SK.settings,JSON.stringify(d)); setSaved("Saved ✓"); setTimeout(()=>setSaved(""),2000); } catch {} },[]);

  const getTpl = id => templates.find(t=>t.id===id)||DEFAULT_TEMPLATES.find(t=>t.id===id);

  // ── Case CRUD ─────────────────────────────────────────────────────────────
  const openNew = (tplId=null) => { setNewCase({templateId:tplId||templates[0]?.id,core:{date:new Date().toISOString().split("T")[0],asa:"II",setting:"Elective",approach:"Laparoscopic"},custom:{}}); setEditingId(null); setPage("new"); };
  const openEdit = c => { setNewCase({templateId:c.templateId,core:{...c.core},custom:{...c.custom}}); setEditingId(c.id); setPage("new"); };
  const setCoreF = (k,v) => setNewCase(p=>({...p,core:{...p.core,[k]:v}}));
  const setCustomF = (k,v) => setNewCase(p=>({...p,custom:{...p.custom,[k]:v}}));

  const saveCase = () => {
    const tpl = getTpl(newCase.templateId);
    const entry = { id:editingId||`OP-${String(cases.length+1).padStart(3,"0")}`, templateId:newCase.templateId, templateName:tpl?.name||"", core:{...newCase.core,orTime:Number(newCase.core.orTime)||0,ebl:Number(newCase.core.ebl)||0,los:newCase.core.los===""?0:Number(newCase.core.los),cost:Number(newCase.core.cost)||0}, custom:newCase.custom, followUps:editingId?(cases.find(c=>c.id===editingId)?.followUps||[]):[], createdAt:editingId?cases.find(c=>c.id===editingId)?.createdAt:new Date().toISOString() };
    const updated = editingId?cases.map(c=>c.id===editingId?entry:c):[entry,...cases];
    setCases(updated); persistCases(updated); setNewCase(null); setEditingId(null); setPage("registry");
  };

  const deleteCase = id => { if(!confirm("Delete?")) return; const u=cases.filter(c=>c.id!==id); setCases(u); persistCases(u); if(detailId===id){setDetailId(null);setPage("registry");} };

  // ── Follow-ups ────────────────────────────────────────────────────────────
  const openDetail = id => { setDetailId(id); setDetailTab("overview"); setNewFU(null); setPage("detail"); };
  const startFU = tp => { const tpl=getTpl(cases.find(c=>c.id===detailId)?.templateId); const def={}; (tpl?.followUpFields||[]).forEach(f=>{def[f.key]="";}); setNewFU({timepoint:tp,fields:def}); };
  const setFUF = (k,v) => setNewFU(p=>({...p,fields:{...p.fields,[k]:v}}));
  const saveFU = () => {
    const updated = cases.map(c=>{ if(c.id!==detailId) return c; const fu={id:uid(),timepoint:newFU.timepoint,date:new Date().toISOString().split("T")[0],fields:newFU.fields}; return {...c,followUps:[...(c.followUps||[]),fu]}; });
    setCases(updated); persistCases(updated); setNewFU(null);
  };
  const deleteFU = (caseId,fuId) => { const u=cases.map(c=>c.id!==caseId?c:{...c,followUps:(c.followUps||[]).filter(f=>f.id!==fuId)}); setCases(u); persistCases(u); };

  // ── Template editor ────────────────────────────────────────────────────────
  const getTplEdit = () => templates.find(t=>t.id===tplEditId);
  const updateTpl = (id,patch) => { const u=templates.map(t=>t.id!==id?t:{...t,...patch}); setTemplates(u); persistTemplates(u); };
  const addTplField = id => { const f={key:"f_"+uid(),label:"New Field",type:"text",options:[]}; updateTpl(id,{fields:[...(getTpl(id)?.fields||[]),f]}); };
  const updateTplField = (id,fkey,prop,val) => { const t=getTpl(id); updateTpl(id,{fields:t.fields.map(f=>f.key!==fkey?f:{...f,[prop]:val})}); };
  const deleteTplField = (id,fkey) => { const t=getTpl(id); updateTpl(id,{fields:t.fields.filter(f=>f.key!==fkey)}); };
  const addTpl = () => { const t={id:uid(),name:"New Procedure",color:"#64748b",emoji:"⬜",patientName:"",patientDesc:"",fields:[],followUpSchedule:["2 weeks","6 months","1 year"],followUpFields:[]}; const u=[...templates,t]; setTemplates(u); persistTemplates(u); setTplEditId(t.id); setTplTab("edit"); };

  // ── Dictation ──────────────────────────────────────────────────────────────
  const toggleListen = () => {
    if(isListening){recRef.current?.stop();setIsListening(false);return;}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setDictError("Use Chrome for voice input, or type below.");return;}
    const rec=new SR(); rec.continuous=true; rec.interimResults=false;
    rec.onresult=e=>{const t=Array.from(e.results).map(r=>r[0].transcript).join(" ");setDictText(p=>(p+" "+t).trim());};
    rec.onerror=()=>setIsListening(false); rec.onend=()=>setIsListening(false);
    rec.start(); recRef.current=rec; setIsListening(true);
  };

  const parseDictation = async () => {
    if(!dictText.trim()) return;
    setDictLoading(true); setDictError(""); setDictResult(null);
    const tplSummary = templates.map(t=>`${t.id} ("${t.name}"): core + custom fields: ${t.fields.map(f=>`${f.key}(${f.type}${f.options?":"+f.options.join("|"):""}`).join(", ")}`).join("\n");
    const sys = `You parse a surgeon's operative dictation into structured JSON for a case registry.
Templates:\n${tplSummary}
Core fields: date(YYYY-MM-DD), cpt, approach(${CORE_FIELDS.find(f=>f.key==="approach").options.join("|")}), asa(I|II|III|IV|V), setting(Elective|Urgent|Emergent), orTime(number), ebl(number), los(number), cost(number), clavien(None|I|II|IIIa|IIIb|IVa|IVb|V), readmit30(bool), mortality30(bool), notes(string).
Today: ${new Date().toISOString().split("T")[0]}.
Return ONLY raw JSON, no markdown:
{"templateId":"<id>","core":{<core fields>},"custom":{<template-specific fields>}}
Pick the best matching template. Fill every field you can infer. Use null for genuinely unknown values. Boolean fields: true or false only.`;
    try {
      const raw = await callClaude(sys, dictText);
      const parsed = JSON.parse(raw.replace(/```json|```/g,"").trim());
      setDictResult({ templateId:parsed.templateId||templates[0]?.id, core:{date:new Date().toISOString().split("T")[0],...(parsed.core||{})}, custom:parsed.custom||{} });
    } catch { setDictError("Parse failed — try rephrasing, or edit manually."); }
    setDictLoading(false);
  };

  const acceptDictResult = () => { setNewCase(dictResult); setEditingId(null); setPage("new"); setDictResult(null); setDictText(""); };

  // ── Advanced filters ───────────────────────────────────────────────────────
  const addAF = () => { if(!newAF.field) return; setAdvFilters(p=>[...p,{...newAF}]); setNewAF({field:"",op:"=",value:""}); };
  const matchesAF = c => advFilters.every(f=>{
    const isCore = CORE_FIELDS.find(cf=>cf.key===f.field);
    const raw = isCore ? c.core[f.field] : c.custom[f.field];
    if(raw===undefined||raw===null) return false;
    const rv=String(raw).toLowerCase(); const fv=f.value.toLowerCase();
    if(f.op==="=") return rv===fv||(fv==="yes"&&raw===true)||(fv==="no"&&raw===false);
    if(f.op==="!=") return rv!==fv;
    if(f.op===">") return Number(raw)>Number(f.value);
    if(f.op==="<") return Number(raw)<Number(f.value);
    if(f.op==="contains") return rv.includes(fv);
    return true;
  });

  const filtered = cases.filter(c=>{
    if(filterTpl!=="all"&&c.templateId!==filterTpl) return false;
    if(search&&!`${c.id} ${c.templateName} ${JSON.stringify(c.core)} ${JSON.stringify(c.custom)}`.toLowerCase().includes(search.toLowerCase())) return false;
    if(advFilters.length>0&&!matchesAF(c)) return false;
    return true;
  });

  // ── Stats helpers ─────────────────────────────────────────────────────────
  const statsFor = (caseSet) => {
    const n = caseSet.length;
    const comps = caseSet.filter(c=>c.core.clavien&&c.core.clavien!=="None");
    const converts = caseSet.filter(c=>c.core.approach?.includes("Converted"));
    const readmits = caseSet.filter(c=>c.core.readmit30);
    const deaths = caseSet.filter(c=>c.core.mortality30);
    const mis = caseSet.filter(c=>["Laparoscopic","Robotic"].includes(c.core.approach));
    const withCost = caseSet.filter(c=>c.core.cost>0);
    return { n, comps, converts, readmits, deaths, mis,
      compPct:parseFloat(pct(comps.length,n)),
      readmitPct:parseFloat(pct(readmits.length,n)),
      mortalityPct:parseFloat(pct(deaths.length,n)),
      misPct:parseFloat(pct(mis.length,n)),
      convertPct:parseFloat(pct(converts.length,n)),
      avgOR: avg(caseSet.map(c=>c.core.orTime||0)),
      avgLOS: avg(caseSet.map(c=>c.core.los??0)),
      avgEBL: avg(caseSet.map(c=>c.core.ebl||0)),
      avgCost: avg(withCost.map(c=>c.core.cost)),
      totalCost: caseSet.reduce((s,c)=>s+(c.core.cost||0),0),
    };
  };

  const now = new Date("2026-03-02");
  const monthly = Array.from({length:6},(_,i)=>{
    const d=new Date(now.getFullYear(),now.getMonth()-5+i,1);
    const mo=cases.filter(c=>{ const cd=new Date(c.core.date+"T12:00:00"); return cd.getMonth()===d.getMonth()&&cd.getFullYear()===d.getFullYear(); });
    return { month:d.toLocaleString("default",{month:"short"}), cases:mo.length, cost:mo.reduce((s,c)=>s+(c.core.cost||0),0)/1000 };
  });

  const overallStats = statsFor(cases);
  const tplStats = templates.map(t=>{ const cs=cases.filter(c=>c.templateId===t.id); return {...statsFor(cs), tpl:t}; }).filter(x=>x.n>0);

  // ── Styles ────────────────────────────────────────────────────────────────
  const D = {
    bg:"#070d1a", card:"#0a1220", border:"#131f30", border2:"#1e293b",
    text:"#94a3b8", textBright:"#e2e8f0", textDim:"#334155", textMid:"#64748b",
    accent:"#1d4ed8", accentLight:"#1e3a5f", accentText:"#93c5fd",
  };
  const inp = { width:"100%",padding:"9px 10px",background:D.bg,border:`1px solid ${D.border2}`,borderRadius:8,color:"#cbd5e1",fontSize:13,fontFamily:"inherit" };
  const Card = ({children,style={}}) => <div style={{background:D.card,border:`1px solid ${D.border}`,borderRadius:12,padding:"18px 20px",...style}}>{children}</div>;
  const SecHd = ({t}) => <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color:D.textDim,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${D.border2}`}}>{t}</div>;
  const Lbl = ({t}) => <label style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:"0.12em",display:"block",marginBottom:5}}>{t}</label>;
  const KPI = ({label,value,sub,color="#f1f5f9"}) => (
    <Card><div style={{fontSize:10,letterSpacing:"0.14em",color:D.textDim,textTransform:"uppercase",marginBottom:6}}>{label}</div>
    <div style={{fontSize:24,fontWeight:700,color,fontFamily:"'JetBrains Mono',monospace"}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:"#1e3a5f",marginTop:4}}>{sub}</div>}</Card>
  );
  const NavBtn = ({v,label,active}) => <button onClick={()=>setPage(v)} style={{padding:"7px 14px",borderRadius:8,border:"1px solid",fontSize:12,fontWeight:500,cursor:"pointer",borderColor:(active||page===v)?D.accent:D.border2,background:(active||page===v)?D.accentLight:"transparent",color:(active||page===v)?D.accentText:"#475569"}}>{label}</button>;

  const th = {padding:"9px 12px",textAlign:"left",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",color:D.textDim,borderBottom:`1px solid #1a2332`,whiteSpace:"nowrap"};
  const td = {padding:"10px 12px",fontSize:12.5,color:D.text,borderBottom:`1px solid #0f1a2a`,verticalAlign:"middle"};

  if (!loaded) return <div style={{background:D.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:D.textDim,fontFamily:"sans-serif"}}>Loading…</div>;

  const detailCase = cases.find(c=>c.id===detailId);
  const detailTpl  = detailCase?getTpl(detailCase.templateId):null;

  // ── Password gate ──────────────────────────────────────────────────────────
  const checkPw = (target) => {
    const correct = target==="colleague" ? settings.colleaguePassword : settings.hospitalPassword;
    if (pwInput===correct) { setPwTarget(null); setPwInput(""); setPwError(""); setPage(target); }
    else { setPwError("Incorrect password."); }
  };

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{background:D.bg,minHeight:"100vh",fontFamily:"'IBM Plex Sans',sans-serif",color:D.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;} button{transition:all 0.15s;cursor:pointer;} button:hover{opacity:0.82;}
        input,select,textarea{outline:none;font-family:inherit;}
        ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-track{background:#0d1424;} ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:4px;}
        .trh:hover{background:#0b1628!important;cursor:pointer;}
        .trh:hover td{background:#0b1628!important;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} .pulsing{animation:pulse 1.5s infinite;}
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 0.8s linear infinite;display:inline-block;}
      `}</style>

      {/* ── Password Gate Modal ─────────────────────────────────────────────── */}
      {pwTarget && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
          <div style={{background:D.card,border:`1px solid ${D.border}`,borderRadius:16,padding:"32px 36px",width:360}}>
            <div style={{fontSize:16,fontWeight:700,color:D.textBright,marginBottom:4}}>🔒 {pwTarget==="colleague"?"Colleague / Clinical View":"Hospital Admin View"}</div>
            <div style={{fontSize:12,color:D.textDim,marginBottom:20}}>This view is password protected.</div>
            <Lbl t="Password" />
            <input type="password" value={pwInput} onChange={e=>setPwInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&checkPw(pwTarget)} autoFocus style={{...inp,marginBottom:8}} placeholder="Enter password…" />
            {pwError&&<div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>{pwError}</div>}
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
              <button onClick={()=>{setPwTarget(null);setPwInput("");setPwError("");}} style={{padding:"9px 16px",borderRadius:8,border:`1px solid ${D.border2}`,background:"transparent",color:"#475569",fontSize:13}}>Cancel</button>
              <button onClick={()=>checkPw(pwTarget)} style={{padding:"9px 22px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",fontSize:13,fontWeight:600}}>Enter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Nav ───────────────────────────────────────────────────────────── */}
      <div style={{background:D.card,borderBottom:`1px solid ${D.border}`,padding:"13px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#1d4ed8,#1e40af)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>🔬</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:D.textBright,letterSpacing:"-0.01em"}}>Surgical Registry</div>
            <div style={{fontSize:10,color:"#1e3a5f",letterSpacing:"0.08em"}}>{cases.length} cases · {templates.length} templates</div>
          </div>
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
          {saved&&<span style={{fontSize:11,color:"#10b981",marginRight:6}}>{saved}</span>}

          {/* Private */}
          <div style={{display:"flex",gap:5,padding:"4px 8px",borderRadius:8,background:"#0f1a2a",border:`1px solid ${D.border}`}}>
            <span style={{fontSize:10,color:"#1e3a5f",alignSelf:"center",letterSpacing:"0.1em",textTransform:"uppercase"}}>Private</span>
            <NavBtn v="registry"  label="📋 Registry" />
            <NavBtn v="dashboard" label="📊 Dashboard" />
            <NavBtn v="templates" label="⚙ Templates" />
          </div>

          {/* Public views */}
          <div style={{display:"flex",gap:5,padding:"4px 8px",borderRadius:8,background:"#0a1a0f",border:"1px solid #14532d"}}>
            <span style={{fontSize:10,color:"#14532d",alignSelf:"center",letterSpacing:"0.1em",textTransform:"uppercase"}}>Public</span>
            <NavBtn v="patient"   label="🧑 Patients" />
            <button onClick={()=>{setPwTarget("colleague");setPwInput("");setPwError("");}} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${page==="colleague"?D.accent:D.border2}`,fontSize:12,fontWeight:500,background:page==="colleague"?D.accentLight:"transparent",color:page==="colleague"?D.accentText:"#475569"}}>🩺 Colleagues 🔒</button>
            <button onClick={()=>{setPwTarget("hospital");setPwInput("");setPwError("");}} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${page==="hospital"?D.accent:D.border2}`,fontSize:12,fontWeight:500,background:page==="hospital"?D.accentLight:"transparent",color:page==="hospital"?D.accentText:"#475569"}}>🏥 Hospital 🔒</button>
          </div>

          <div style={{width:1,height:20,background:D.border2}} />
          <button onClick={()=>setPage("settings")} style={{padding:"7px 12px",borderRadius:8,border:`1px solid ${D.border2}`,background:"transparent",color:"#475569",fontSize:12}}>⚙ Settings</button>
          <button onClick={()=>{setDictText("");setDictError("");setDictResult(null);setPage("dictate");}} style={{padding:"7px 13px",borderRadius:8,border:"1px solid #1e3a5f",fontSize:12,fontWeight:600,background:"#0f1f3d",color:"#60a5fa"}}>🎙 Dictate</button>
          <button onClick={()=>openNew()} style={{padding:"7px 14px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff"}}>+ New Case</button>
        </div>
      </div>

      <div style={{padding:"22px 24px",maxWidth:1400,margin:"0 auto"}}>

        {/* ══════════════════════════════════════════════════════════════════════
            REGISTRY
        ══════════════════════════════════════════════════════════════════════ */}
        {page==="registry" && (
          <div>
            {/* Search + filter bar */}
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search cases, fields, notes…" style={{flex:1,minWidth:180,...inp,padding:"8px 12px"}} />
              <select value={filterTpl} onChange={e=>setFilterTpl(e.target.value)} style={{...inp,width:"auto",padding:"8px 12px"}}>
                <option value="all">All Procedure Types</option>
                {templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={()=>setShowAF(p=>!p)} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${advFilters.length?"#2563eb":D.border2}`,background:advFilters.length?D.accentLight:"transparent",color:advFilters.length?D.accentText:"#475569",fontSize:12}}>
                🔎 Filter{advFilters.length?` (${advFilters.length})`:""}
              </button>
              <span style={{fontSize:11,color:"#1e3a5f"}}>{filtered.length} cases</span>
            </div>

            {/* Advanced filter panel */}
            {showAF && (
              <Card style={{marginBottom:12,border:`1px solid ${D.accentLight}`}}>
                <div style={{fontSize:11,fontWeight:600,color:"#475569",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.1em"}}>Advanced Filter — filter any field against any outcome</div>
                {advFilters.map((f,i)=>(
                  <div key={i} style={{display:"inline-flex",alignItems:"center",gap:6,marginRight:8,marginBottom:6,padding:"4px 10px",borderRadius:6,background:"#0f1f3d",border:`1px solid ${D.accentLight}`}}>
                    <span style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:"#60a5fa"}}>{f.field} {f.op} "{f.value}"</span>
                    <button onClick={()=>setAdvFilters(p=>p.filter((_,j)=>j!==i))} style={{fontSize:11,color:"#ef4444",background:"none",border:"none",padding:0,lineHeight:1}}>✕</button>
                  </div>
                ))}
                <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap",marginTop:8}}>
                  <div>
                    <div style={{fontSize:10,color:D.textDim,marginBottom:3}}>Field</div>
                    <input value={newAF.field} onChange={e=>setNewAF(p=>({...p,field:e.target.value}))} placeholder="dm, bmi, meshType, herniaType…" style={{...inp,width:190,padding:"7px 8px",fontSize:12}} list="af-fields" />
                    <datalist id="af-fields">
                      {[...CORE_FIELDS,...templates.flatMap(t=>t.fields)].map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
                    </datalist>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:D.textDim,marginBottom:3}}>Op</div>
                    <select value={newAF.op} onChange={e=>setNewAF(p=>({...p,op:e.target.value}))} style={{...inp,width:100,padding:"7px 8px",fontSize:12}}>
                      {["=","!=",">","<","contains"].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:D.textDim,marginBottom:3}}>Value</div>
                    <input value={newAF.value} onChange={e=>setNewAF(p=>({...p,value:e.target.value}))} placeholder="yes / no / W3 / TAR…" style={{...inp,width:150,padding:"7px 8px",fontSize:12}} />
                  </div>
                  <button onClick={addAF} style={{padding:"8px 16px",borderRadius:8,border:"none",background:D.accent,color:"#fff",fontSize:12,fontWeight:600}}>+ Add</button>
                  {advFilters.length>0&&<button onClick={()=>setAdvFilters([])} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${D.border2}`,background:"transparent",color:"#475569",fontSize:12}}>Clear all</button>}
                </div>
                {advFilters.length>0 && (
                  <div style={{marginTop:12,padding:"10px 14px",background:D.bg,borderRadius:8,fontSize:12,color:"#475569"}}>
                    <strong style={{color:D.textBright}}>{filtered.length}</strong> cases match ·{" "}
                    <strong style={{color:filtered.filter(c=>c.core.clavien&&c.core.clavien!=="None").length>0?"#f97316":"#10b981"}}>{pct(filtered.filter(c=>c.core.clavien&&c.core.clavien!=="None").length,filtered.length)}%</strong> complication rate ·{" "}
                    <strong>{pct(filtered.filter(c=>c.core.readmit30).length,filtered.length)}%</strong> readmission rate
                  </div>
                )}
              </Card>
            )}

            {/* Case list */}
            {filtered.length===0 ? (
              <Card style={{textAlign:"center",padding:"60px 24px"}}>
                <div style={{fontSize:32,marginBottom:12}}>{cases.length===0?"🗂️":"🔍"}</div>
                <div style={{fontSize:15,color:"#475569",marginBottom:12}}>{cases.length===0?"No cases yet — log your first case":"No cases match your filters"}</div>
                {cases.length===0&&<button onClick={()=>openNew()} style={{padding:"10px 24px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",fontSize:13,fontWeight:600}}>+ Log First Case</button>}
              </Card>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {filtered.map(c=>{
                  const tpl=getTpl(c.templateId);
                  const fuDone=(c.followUps||[]).length;
                  const fuDue=(tpl?.followUpSchedule||[]).filter(tp=>!(c.followUps||[]).find(f=>f.timepoint===tp));
                  const hasComp=c.core.clavien&&c.core.clavien!=="None";
                  return (
                    <div key={c.id} className="trh" onClick={()=>openDetail(c.id)} style={{background:D.card,border:`1px solid ${D.border}`,borderRadius:10,padding:"13px 18px",display:"flex",alignItems:"center",gap:14}}>
                      <div style={{width:4,height:36,borderRadius:2,background:tpl?.color||"#475569",flexShrink:0}} />
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                          <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:"#3b82f6",flexShrink:0}}>{c.id}</span>
                          <span style={{fontSize:11,padding:"1px 8px",borderRadius:20,background:(tpl?.color||"#475569")+"22",color:tpl?.color||"#475569",flexShrink:0}}>{tpl?.emoji||""} {c.templateName}</span>
                          {hasComp&&<span style={{fontSize:10,padding:"1px 8px",borderRadius:20,background:CD_COL[c.core.clavien]+"22",color:CD_COL[c.core.clavien],flexShrink:0}}>Gr {c.core.clavien}</span>}
                          {c.core.readmit30&&<span style={{fontSize:10,padding:"1px 8px",borderRadius:20,background:"#f9731622",color:"#f97316",flexShrink:0}}>Readmit</span>}
                          {fuDue.length>0&&<span style={{fontSize:10,padding:"1px 8px",borderRadius:20,background:"#fbbf2418",color:"#fbbf24",flexShrink:0}}>FU due: {fuDue[0]}</span>}
                        </div>
                        <div style={{fontSize:12,color:D.textMid,display:"flex",flexWrap:"wrap",gap:10}}>
                          {(tpl?.fields||[]).slice(0,5).map(f=>{
                            const v=c.custom[f.key];
                            if(v===undefined||v===null||v==="") return null;
                            return <span key={f.key}><span style={{color:D.textDim}}>{f.label}:</span> {f.type==="boolean"?(v?"Yes":"No"):String(v)}</span>;
                          })}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:14,alignItems:"center",flexShrink:0}}>
                        {[["Date",fmtD(c.core.date)],c.core.orTime?["OR",`${c.core.orTime}m`]:null,c.core.los!=null&&c.core.los!==""?["LOS",`${c.core.los}d`]:null,fuDone?["FU",String(fuDone)]:null].filter(Boolean).map(([l,v])=>(
                          <div key={l} style={{textAlign:"right"}}>
                            <div style={{fontSize:10,color:"#1e3a5f"}}>{l}</div>
                            <div style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:D.textMid}}>{v}</div>
                          </div>
                        ))}
                        <button onClick={e=>{e.stopPropagation();openEdit(c);}} style={{fontSize:11,color:"#3b82f6",background:"none",border:"none",padding:"4px 8px"}}>Edit</button>
                        <button onClick={e=>{e.stopPropagation();deleteCase(c.id);}} style={{fontSize:11,color:"#ef4444",background:"none",border:"none",padding:"4px 8px"}}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            CASE DETAIL
        ══════════════════════════════════════════════════════════════════════ */}
        {page==="detail" && detailCase && (
          <div style={{maxWidth:960}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <button onClick={()=>setPage("registry")} style={{fontSize:12,color:"#475569",background:"none",border:`1px solid ${D.border2}`,borderRadius:6,padding:"5px 12px"}}>← Back</button>
              <span style={{fontSize:13,fontFamily:"'JetBrains Mono',monospace",color:"#3b82f6"}}>{detailCase.id}</span>
              <span style={{fontSize:12,padding:"2px 10px",borderRadius:20,background:(detailTpl?.color||"#475569")+"22",color:detailTpl?.color||"#475569"}}>{detailTpl?.emoji} {detailCase.templateName}</span>
              <span style={{fontSize:12,color:"#475569"}}>{fmtD(detailCase.core.date)}</span>
              <div style={{flex:1}} />
              <button onClick={()=>openEdit(detailCase)} style={{padding:"7px 16px",borderRadius:8,border:`1px solid ${D.border2}`,background:"transparent",color:"#475569",fontSize:12}}>Edit Case</button>
            </div>
            {/* Tabs */}
            <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`1px solid ${D.border2}`}}>
              {[["overview","Overview"],["followups",`Follow-ups (${(detailCase.followUps||[]).length})`]].map(([tab,label])=>(
                <button key={tab} onClick={()=>setDetailTab(tab)} style={{padding:"10px 20px",border:"none",background:"transparent",fontSize:12.5,fontWeight:500,color:detailTab===tab?D.accentText:"#334155",borderBottom:`2px solid ${detailTab===tab?"#2563eb":"transparent"}`,marginBottom:-1}}>
                  {label}
                </button>
              ))}
            </div>

            {detailTab==="overview" && (
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <Card>
                  <SecHd t="Core Operative Data" />
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                    {CORE_FIELDS.filter(f=>!["textarea"].includes(f.type)).map(f=>{
                      const v=detailCase.core[f.key];
                      if(v===undefined||v===null||v==="") return null;
                      return <div key={f.key}><div style={{fontSize:10,color:D.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>{f.label}</div>{renderVal(f,v)}</div>;
                    })}
                  </div>
                  {detailCase.core.notes&&<div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${D.border2}`}}><div style={{fontSize:10,color:D.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Operative Notes</div><div style={{fontSize:12.5,color:D.textMid,fontStyle:"italic",lineHeight:1.6}}>{detailCase.core.notes}</div></div>}
                </Card>
                {detailTpl&&detailTpl.fields.length>0&&(
                  <Card>
                    <SecHd t={`${detailCase.templateName} — Specific Data`} />
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                      {detailTpl.fields.filter(f=>f.type!=="textarea").map(f=>(
                        <div key={f.key}><div style={{fontSize:10,color:D.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>{f.label}</div>{renderVal(f,detailCase.custom[f.key])}</div>
                      ))}
                    </div>
                    {detailTpl.fields.filter(f=>f.type==="textarea").map(f=>detailCase.custom[f.key]&&(
                      <div key={f.key} style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${D.border2}`}}><div style={{fontSize:10,color:D.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{f.label}</div><div style={{fontSize:12.5,color:D.textMid,fontStyle:"italic",lineHeight:1.6}}>{detailCase.custom[f.key]}</div></div>
                    ))}
                  </Card>
                )}
              </div>
            )}

            {detailTab==="followups" && (
              <div>
                {/* Schedule overview */}
                {detailTpl?.followUpSchedule&&(
                  <Card style={{marginBottom:14}}>
                    <SecHd t="Follow-up Schedule" />
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {detailTpl.followUpSchedule.map(tp=>{
                        const done=(detailCase.followUps||[]).find(f=>f.timepoint===tp);
                        return (
                          <div key={tp} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${done?"#10b98133":D.border2}`,background:done?"#10b98108":"transparent",display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:12,color:done?"#10b981":"#475569"}}>{done?"✓ ":""}{tp}</span>
                            {!done&&<button onClick={()=>startFU(tp)} style={{fontSize:10,color:"#3b82f6",background:"none",border:"none",padding:0,fontWeight:600}}>+ Log</button>}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* New follow-up form */}
                {newFU&&detailTpl&&(
                  <Card style={{marginBottom:14,border:`1px solid ${D.accentLight}`}}>
                    <div style={{fontSize:13,fontWeight:600,color:D.textBright,marginBottom:16}}>Log Follow-up — {newFU.timepoint}</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
                      {detailTpl.followUpFields.filter(f=>f.type!=="textarea").map(f=>(
                        <div key={f.key}><Lbl t={f.label} /><FieldInput field={f} value={newFU.fields[f.key]} onChange={v=>setFUF(f.key,v)} compact /></div>
                      ))}
                    </div>
                    {detailTpl.followUpFields.filter(f=>f.type==="textarea").map(f=>(
                      <div key={f.key} style={{marginBottom:10}}><Lbl t={f.label} /><FieldInput field={f} value={newFU.fields[f.key]} onChange={v=>setFUF(f.key,v)} compact /></div>
                    ))}
                    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
                      <button onClick={()=>setNewFU(null)} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${D.border2}`,background:"transparent",color:"#475569",fontSize:13}}>Cancel</button>
                      <button onClick={saveFU} style={{padding:"8px 22px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",fontSize:13,fontWeight:600}}>Save Follow-up</button>
                    </div>
                  </Card>
                )}

                {/* Existing follow-ups */}
                {(detailCase.followUps||[]).length===0&&!newFU&&<div style={{color:D.textDim,fontSize:13,padding:"20px 0"}}>No follow-ups logged yet.</div>}
                {(detailCase.followUps||[]).slice().sort((a,b)=>(detailTpl?.followUpSchedule||[]).indexOf(a.timepoint)-(detailTpl?.followUpSchedule||[]).indexOf(b.timepoint)).map(fu=>(
                  <Card key={fu.id} style={{marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontSize:12,fontWeight:600,color:D.textBright}}>{fu.timepoint}</span>
                        <span style={{fontSize:11,color:D.textDim,fontFamily:"'JetBrains Mono',monospace"}}>{fmtD(fu.date)}</span>
                      </div>
                      <button onClick={()=>deleteFU(detailCase.id,fu.id)} style={{fontSize:11,color:"#ef4444",background:"none",border:"none"}}>✕</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                      {detailTpl?.followUpFields.filter(f=>f.type!=="textarea").map(f=>(
                        <div key={f.key}><div style={{fontSize:10,color:D.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>{f.label}</div>{renderVal(f,fu.fields[f.key])}</div>
                      ))}
                    </div>
                    {detailTpl?.followUpFields.filter(f=>f.type==="textarea").map(f=>fu.fields[f.key]&&(
                      <div key={f.key} style={{marginTop:8,fontSize:12,color:D.textMid,fontStyle:"italic"}}>{fu.fields[f.key]}</div>
                    ))}
                  </Card>
                ))}
                {detailTpl&&!newFU&&(
                  <div style={{marginTop:10}}>
                    <select onChange={e=>{if(e.target.value){startFU(e.target.value);}e.target.value="";}} defaultValue="" style={{...inp,width:"auto",padding:"8px 14px",fontSize:12}}>
                      <option value="">+ Log follow-up at any timepoint…</option>
                      {detailTpl.followUpSchedule.map(tp=><option key={tp} value={tp}>{tp}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            NEW / EDIT CASE
        ══════════════════════════════════════════════════════════════════════ */}
        {page==="new" && newCase && (()=>{
          const tpl=getTpl(newCase.templateId);
          return (
            <div style={{maxWidth:820}}>
              <div style={{fontSize:18,fontWeight:700,color:D.textBright,marginBottom:20}}>{editingId?`✏ Edit ${editingId}`:"➕ New Case"}</div>
              {/* Template picker */}
              <Card style={{marginBottom:14}}>
                <SecHd t="Procedure Type" />
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {templates.map(t=>(
                    <button key={t.id} onClick={()=>setNewCase(p=>({...p,templateId:t.id}))} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${newCase.templateId===t.id?t.color:D.border2}`,background:newCase.templateId===t.id?t.color+"22":"transparent",color:newCase.templateId===t.id?t.color:"#475569",fontSize:13,fontWeight:newCase.templateId===t.id?600:400}}>
                      {t.emoji} {t.name}
                    </button>
                  ))}
                </div>
              </Card>
              {/* Core fields */}
              <Card style={{marginBottom:14}}>
                <SecHd t="Core Fields" />
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {CORE_FIELDS.map(f=>(
                    <div key={f.key} style={{gridColumn:f.type==="textarea"?"span 2":"auto"}}>
                      <Lbl t={f.label+(f.required?" *":"")} />
                      <FieldInput field={f} value={newCase.core[f.key]} onChange={v=>setCoreF(f.key,v)} />
                    </div>
                  ))}
                </div>
              </Card>
              {/* Template-specific fields */}
              {tpl&&tpl.fields.length>0&&(
                <Card style={{marginBottom:14}}>
                  <SecHd t={`${tpl.name} — Specific Fields`} />
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    {tpl.fields.map(f=>(
                      <div key={f.key} style={{gridColumn:f.type==="textarea"?"span 2":"auto"}}>
                        <Lbl t={f.label} />
                        <FieldInput field={f} value={newCase.custom[f.key]} onChange={v=>setCustomF(f.key,v)} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button onClick={()=>{setPage("registry");setNewCase(null);setEditingId(null);}} style={{padding:"10px 20px",borderRadius:8,border:`1px solid ${D.border2}`,background:"transparent",color:"#475569",fontSize:13}}>Cancel</button>
                <button onClick={saveCase} disabled={!newCase.core.date} style={{padding:"10px 28px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",fontSize:13,fontWeight:600,opacity:newCase.core.date?1:0.5}}>{editingId?"Save Changes":"Log Case"}</button>
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════════
            PRIVATE DASHBOARD
        ══════════════════════════════════════════════════════════════════════ */}
        {page==="dashboard" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>
              <KPI label="Total Cases" value={cases.length} />
              <KPI label="Complication Rate" value={`${pct(overallStats.comps.length,overallStats.n)}%`} color={overallStats.compPct>10?"#f97316":"#10b981"} sub={`${overallStats.comps.length} cases`} />
              <KPI label="30d Readmission" value={`${pct(overallStats.readmits.length,overallStats.n)}%`} color={overallStats.readmitPct>8?"#f97316":"#10b981"} sub={`${overallStats.readmits.length} cases`} />
              <KPI label="MIS Rate" value={`${pct(overallStats.mis.length,overallStats.n)}%`} color="#38bdf8" sub="Lap + Robotic" />
              <KPI label="Avg Cost" value={dollar(Math.round(overallStats.avgCost))} color="#4ade80" sub={`Total ${dollar(overallStats.totalCost)}`} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:14}}>
              <Card>
                <div style={{fontSize:10,color:D.textDim,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:12}}>Monthly Volume</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={monthly}><XAxis dataKey="month" tick={{fontSize:11,fill:"#334155"}} axisLine={false} tickLine={false} /><YAxis tick={{fontSize:10,fill:"#334155"}} axisLine={false} tickLine={false} /><Tooltip contentStyle={{background:D.card,border:`1px solid ${D.border}`,borderRadius:8,fontSize:11}} /><Bar dataKey="cases" fill="#1d4ed8" radius={[4,4,0,0]} /></BarChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <div style={{fontSize:10,color:D.textDim,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:12}}>Case Mix</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart><Pie data={tplStats.map(s=>({name:s.tpl.name,value:s.n}))} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={3}>
                    {tplStats.map((s,i)=><Cell key={i} fill={s.tpl.color} />)}
                  </Pie><Tooltip contentStyle={{background:D.card,border:`1px solid ${D.border}`,borderRadius:8,fontSize:11}} /></PieChart>
                </ResponsiveContainer>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                  {tplStats.map(s=><div key={s.tpl.id} style={{display:"flex",alignItems:"center",gap:4,fontSize:10.5,color:"#475569"}}><div style={{width:7,height:7,borderRadius:2,background:s.tpl.color}} />{s.tpl.name}: {s.n}</div>)}
                </div>
              </Card>
            </div>
            {/* Per-template stats */}
            <Card>
              <SecHd t="Outcomes by Procedure Type" />
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:D.bg}}>{["Procedure","n","Comp %","Readmit %","Mortality %","MIS %","Convert %","Avg OR","Avg LOS","Avg Cost"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {tplStats.map(s=>{
                      const bench=NSQIP[s.tpl.id];
                      const G=(v,b)=>v<=b?"#10b981":"#ef4444";
                      return (
                        <tr key={s.tpl.id} className="trh">
                          <td style={{...td,color:s.tpl.color,fontWeight:600}}>{s.tpl.emoji} {s.tpl.name}</td>
                          <td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{s.n}</td>
                          <td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:bench?G(s.compPct,bench.complications):"#94a3b8"}}>{pct(s.comps.length,s.n)}%</td>
                          <td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:bench?G(s.readmitPct,bench.conversion/2):"#94a3b8"}}>{pct(s.readmits.length,s.n)}%</td>
                          <td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:s.deaths.length>0?"#ef4444":"#10b981"}}>{pct(s.deaths.length,s.n)}%</td>
                          <td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"#38bdf8"}}>{pct(s.mis.length,s.n)}%</td>
                          <td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{pct(s.converts.length,s.n)}%</td>
                          <td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{Math.round(s.avgOR)}m</td>
                          <td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{s.avgLOS.toFixed(1)}d</td>
                          <td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"#4ade80"}}>{s.avgCost>0?dollar(Math.round(s.avgCost)):"—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TEMPLATE EDITOR
        ══════════════════════════════════════════════════════════════════════ */}
        {page==="templates" && (
          <div>
            {tplTab==="list" && (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:700,color:D.textBright,marginBottom:2}}>⚙ Procedure Templates</div>
                    <div style={{fontSize:12,color:D.textDim}}>Define which fields to capture per procedure. Add, rename, or remove fields at any time — all changes apply going forward.</div>
                  </div>
                  <button onClick={addTpl} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",fontSize:12,fontWeight:600}}>+ New Template</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {templates.map(t=>(
                    <Card key={t.id} style={{borderLeft:`3px solid ${t.color}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:600,color:D.textBright}}>{t.emoji} {t.name}</div>
                          <div style={{fontSize:11,color:D.textDim,marginTop:2}}>{t.fields.length} case fields · {(t.followUpSchedule||[]).length} follow-up timepoints · {cases.filter(c=>c.templateId===t.id).length} cases logged</div>
                        </div>
                        <button onClick={()=>{setTplEditId(t.id);setTplTab("edit");}} style={{padding:"5px 14px",borderRadius:8,border:`1px solid ${D.border2}`,background:"transparent",color:"#475569",fontSize:12,flexShrink:0}}>Edit</button>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {t.fields.slice(0,6).map(f=><span key={f.key} style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:D.border2,color:"#475569"}}>{f.label}</span>)}
                        {t.fields.length>6&&<span style={{fontSize:10,color:D.textDim}}>+{t.fields.length-6} more</span>}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {tplTab==="edit" && tplEditId && (()=>{
              const et=getTpl(tplEditId);
              return (
                <div style={{maxWidth:800}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                    <button onClick={()=>setTplTab("list")} style={{fontSize:12,color:"#475569",background:"none",border:`1px solid ${D.border2}`,borderRadius:6,padding:"5px 12px"}}>← Back</button>
                    <div style={{fontSize:16,fontWeight:700,color:D.textBright}}>Edit: {et?.name}</div>
                  </div>
                  <Card style={{marginBottom:14}}>
                    <SecHd t="Template Info" />
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto auto",gap:12,alignItems:"end"}}>
                      <div><Lbl t="Template Name" /><input value={et.name} onChange={e=>updateTpl(tplEditId,{name:e.target.value})} style={inp} /></div>
                      <div><Lbl t="Patient-Facing Name" /><input value={et.patientName||""} onChange={e=>updateTpl(tplEditId,{patientName:e.target.value})} placeholder="Plain language name for patients" style={inp} /></div>
                      <div><Lbl t="Emoji" /><input value={et.emoji||""} onChange={e=>updateTpl(tplEditId,{emoji:e.target.value})} style={{...inp,width:60}} /></div>
                      <div><Lbl t="Color" /><input type="color" value={et.color||"#3b82f6"} onChange={e=>updateTpl(tplEditId,{color:e.target.value})} style={{...inp,width:60,padding:4,cursor:"pointer"}} /></div>
                    </div>
                    <div style={{marginTop:12}}>
                      <Lbl t="Patient-Facing Description" />
                      <textarea value={et.patientDesc||""} onChange={e=>updateTpl(tplEditId,{patientDesc:e.target.value})} rows={2} placeholder="Plain-language description shown to patients" style={{...inp,resize:"vertical"}} />
                    </div>
                    <div style={{marginTop:12}}>
                      <Lbl t="Follow-up Schedule (comma separated)" />
                      <input value={(et.followUpSchedule||[]).join(", ")} onChange={e=>updateTpl(tplEditId,{followUpSchedule:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})} style={inp} />
                    </div>
                  </Card>
                  <Card style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color:D.textDim}}>Case Fields</div>
                      <button onClick={()=>addTplField(tplEditId)} style={{padding:"5px 14px",borderRadius:8,border:"none",background:D.accent,color:"#fff",fontSize:12,fontWeight:600}}>+ Add Field</button>
                    </div>
                    {et.fields.map(f=>(
                      <div key={f.key} style={{display:"grid",gridTemplateColumns:"1fr 120px 1fr auto",gap:8,alignItems:"end",padding:"10px 12px",background:D.bg,borderRadius:8,border:`1px solid ${D.border2}`,marginBottom:6}}>
                        <div><div style={{fontSize:10,color:D.textDim,marginBottom:3}}>Label</div><input value={f.label} onChange={e=>updateTplField(tplEditId,f.key,"label",e.target.value)} style={{...inp,fontSize:12}} /></div>
                        <div><div style={{fontSize:10,color:D.textDim,marginBottom:3}}>Type</div>
                          <select value={f.type} onChange={e=>updateTplField(tplEditId,f.key,"type",e.target.value)} style={{...inp,fontSize:12}}>
                            {["text","number","boolean","select","textarea"].map(o=><option key={o}>{o}</option>)}
                          </select>
                        </div>
                        <div><div style={{fontSize:10,color:D.textDim,marginBottom:3}}>{f.type==="select"?"Options (comma separated)":"Placeholder"}</div>
                          <input value={f.type==="select"?(f.options||[]).join(", "):(f.placeholder||"")} onChange={e=>updateTplField(tplEditId,f.key,f.type==="select"?"options":"placeholder",f.type==="select"?e.target.value.split(",").map(s=>s.trim()).filter(Boolean):e.target.value)} style={{...inp,fontSize:12}} />
                        </div>
                        <button onClick={()=>deleteTplField(tplEditId,f.key)} style={{fontSize:12,color:"#ef4444",background:"none",border:"none",padding:"4px 8px",alignSelf:"center"}}>✕</button>
                      </div>
                    ))}
                    {et.fields.length===0&&<div style={{fontSize:12,color:D.textDim,padding:"16px",textAlign:"center"}}>No fields yet.</div>}
                  </Card>
                  <div style={{fontSize:11,color:"#1e3a5f"}}>Changes save automatically. Core fields (date, OR time, EBL, LOS, cost, Clavien-Dindo, readmission, mortality) are always captured regardless of template.</div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            DICTATE
        ══════════════════════════════════════════════════════════════════════ */}
        {page==="dictate" && (
          <div style={{maxWidth:780}}>
            <div style={{fontSize:20,fontWeight:700,color:D.textBright,marginBottom:4}}>🎙 Dictate Case</div>
            <div style={{fontSize:13,color:D.textDim,lineHeight:1.65,marginBottom:20}}>Speak or type a natural summary. Claude picks the right template and fills every field it can infer — including procedure-specific fields. You review and confirm before anything saves.</div>
            <Card style={{marginBottom:14,background:D.bg,border:`1px solid #1a2332`}}>
              <div style={{fontSize:10,color:D.textDim,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:10}}>Example — click to use</div>
              {[
                "Lap chole yesterday, ASA 2, 48 min, EBL minimal, uncomplicated symptomatic cholelithiasis, critical view achieved, no IOC. Discharged same day.",
                "Robotic TAR hernia repair. 61yo male, BMI 34, diabetic. Large W3 incisional hernia 12cm defect, recurrent. 30×20 lightweight PP mesh, TAR with posterior component separation. 3h5m. EBL 50. LOS 2 days. Seroma at 2 weeks, no infection.",
                "Lap appy, urgent. 19yo, uncomplicated acute appy. Endoloop. 35 min. LOS 1 day. No complications.",
              ].map((ex,i)=>(
                <div key={i} onClick={()=>setDictText(ex)} style={{fontSize:12,color:"#475569",padding:"8px 12px",borderRadius:6,background:D.card,marginBottom:6,cursor:"pointer",border:`1px solid ${D.border}`,fontStyle:"italic",lineHeight:1.55}}>"{ex}"</div>
              ))}
            </Card>
            <Card style={{marginBottom:14}}>
              <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center"}}>
                <button onClick={toggleListen} style={{padding:"9px 16px",borderRadius:8,border:"none",fontSize:13,fontWeight:600,background:isListening?"#7f1d1d":"#1e3a5f",color:isListening?"#fca5a5":"#93c5fd",display:"flex",alignItems:"center",gap:8}}>
                  {isListening?<><span className="pulsing">●</span>Stop</>:"🎙 Record"}
                </button>
                {isListening&&<span style={{fontSize:12,color:"#475569"}}>Listening…</span>}
              </div>
              <textarea value={dictText} onChange={e=>setDictText(e.target.value)} placeholder="Or type here…" rows={5} style={{...inp,resize:"vertical",lineHeight:1.6,marginBottom:10}} />
              <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                <button onClick={()=>setDictText("")} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${D.border2}`,background:"transparent",color:"#475569",fontSize:13}}>Clear</button>
                <button onClick={parseDictation} disabled={!dictText.trim()||dictLoading} style={{padding:"8px 22px",borderRadius:8,border:"none",background:dictText.trim()&&!dictLoading?"linear-gradient(135deg,#1d4ed8,#1e40af)":D.border2,color:dictText.trim()&&!dictLoading?"#fff":"#334155",cursor:dictText.trim()&&!dictLoading?"pointer":"default",fontSize:13,fontWeight:600}}>
                  {dictLoading?<><span className="spin">⟳</span> Parsing…</>:"Parse with AI →"}
                </button>
              </div>
              {dictError&&<div style={{fontSize:12,color:"#ef4444",marginTop:8}}>{dictError}</div>}
            </Card>
            {dictResult&&(()=>{
              const tpl=getTpl(dictResult.templateId);
              return (
                <Card style={{border:`1px solid ${D.accentLight}`}}>
                  <div style={{fontSize:13,fontWeight:600,color:D.textBright,marginBottom:4}}>✓ Parsed — review before saving</div>
                  <div style={{fontSize:12,color:D.textDim,marginBottom:14}}>Template: <span style={{color:tpl?.color||"#fff",fontWeight:600}}>{tpl?.emoji} {tpl?.name}</span></div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
                    {CORE_FIELDS.filter(f=>f.type!=="textarea").map(f=>{
                      const v=dictResult.core[f.key];
                      if(!v&&v!==false&&v!==0) return null;
                      return <div key={f.key}><div style={{fontSize:10,color:D.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>{f.label}</div><div style={{fontSize:12,color:"#94a3b8"}}>{f.type==="boolean"?(v?"Yes":"No"):String(v)}</div></div>;
                    })}
                  </div>
                  {tpl&&Object.keys(dictResult.custom).filter(k=>dictResult.custom[k]!==null&&dictResult.custom[k]!=="").length>0&&(
                    <div style={{paddingTop:12,borderTop:`1px solid ${D.border2}`,marginBottom:12}}>
                      <div style={{fontSize:10,color:D.textDim,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:8}}>{tpl.name} fields</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                        {tpl.fields.filter(f=>dictResult.custom[f.key]!==null&&dictResult.custom[f.key]!=="").map(f=>(
                          <div key={f.key}><div style={{fontSize:10,color:D.textDim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>{f.label}</div><div style={{fontSize:12,color:"#94a3b8"}}>{f.type==="boolean"?(dictResult.custom[f.key]?"Yes":"No"):String(dictResult.custom[f.key])}</div></div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                    <button onClick={()=>setDictResult(null)} style={{padding:"9px 16px",borderRadius:8,border:`1px solid ${D.border2}`,background:"transparent",color:"#475569",fontSize:13}}>Discard</button>
                    <button onClick={acceptDictResult} style={{padding:"9px 22px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",fontSize:13,fontWeight:600}}>Edit & Save →</button>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SETTINGS
        ══════════════════════════════════════════════════════════════════════ */}
        {page==="settings" && (
          <div style={{maxWidth:760}}>
            <div style={{fontSize:18,fontWeight:700,color:D.textBright,marginBottom:20}}>⚙ Settings</div>
            {[
              {key:"surgeonName",label:"Surgeon / Practice Name"},
              {key:"practiceName",label:"Subtitle / Specialty"},
              {key:"tagline",label:"Tagline (shown on public views)"},
              {key:"colleaguePassword",label:"Colleague View Password"},
              {key:"hospitalPassword",label:"Hospital Admin View Password"},
            ].map(f=>(
              <div key={f.key} style={{marginBottom:14}}>
                <Card>
                  <Lbl t={f.label} />
                  <input type={f.key.includes("Password")?"password":"text"} value={settings[f.key]||""} onChange={e=>{ const u={...settings,[f.key]:e.target.value}; setSettings(u); persistSettings(u); }} style={inp} />
                </Card>
              </div>
            ))}
            {/* Per-view toggles */}
            {[
              {viewKey:"patient",  label:"Patient View",          fields:[{k:"showVolume",l:"Show Volume"},{k:"showComplications",l:"Complications"},{k:"showLOS",l:"Length of Stay"},{k:"showCost",l:"Cost (avg)"},{k:"showConversion",l:"Conversion Rate"},{k:"showReadmission",l:"Readmission Rate"},{k:"showSatisfaction",l:"Satisfaction Scores"},{k:"showNSQIP",l:"NSQIP Benchmarks"}] },
              {viewKey:"colleague",label:"Colleague View",         fields:[{k:"showVolume",l:"Volume"},{k:"showComplications",l:"Complications"},{k:"showClavien",l:"Clavien Grade"},{k:"showSSI",l:"SSI Rate"},{k:"showLOS",l:"LOS"},{k:"showCost",l:"Cost"},{k:"showConversion",l:"Conversion Rate"},{k:"showReadmission",l:"Readmission"},{k:"showMortality",l:"30d Mortality"},{k:"showNSQIP",l:"NSQIP Benchmarks"},{k:"showApproach",l:"Approach Breakdown"}] },
              {viewKey:"hospital", label:"Hospital Admin View",    fields:[{k:"showCost",l:"Cost"},{k:"showLOS",l:"LOS"},{k:"showORTime",l:"OR Time"},{k:"showReadmission",l:"Readmission"},{k:"showMortality",l:"Mortality"},{k:"showVolume",l:"Volume"},{k:"showConversion",l:"Conversion Rate"}] },
            ].map(({viewKey,label,fields})=>(
              <Card key={viewKey} style={{marginBottom:14}}>
                <SecHd t={`${label} — Visible Metrics`} />
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {fields.map(({k,l})=>(
                    <label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"6px 10px",borderRadius:6,background:settings[viewKey]?.[k]?"#0f1f3d":D.bg,border:`1px solid ${settings[viewKey]?.[k]?"#1e3a5f":D.border2}`}}>
                      <input type="checkbox" checked={!!settings[viewKey]?.[k]} onChange={e=>{ const u={...settings,[viewKey]:{...settings[viewKey],[k]:e.target.checked}}; setSettings(u); persistSettings(u); }} style={{accentColor:"#2563eb"}} />
                      <span style={{fontSize:12,color:settings[viewKey]?.[k]?"#93c5fd":"#475569"}}>{l}</span>
                    </label>
                  ))}
                </div>
                {viewKey==="patient"&&(
                  <div style={{marginTop:14}}>
                    <Lbl t="Patient View Intro Text" />
                    <textarea value={settings.patient?.introText||""} onChange={e=>{ const u={...settings,patient:{...settings.patient,introText:e.target.value}}; setSettings(u); persistSettings(u); }} rows={3} style={{...inp,resize:"vertical"}} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            PATIENT VIEW
        ══════════════════════════════════════════════════════════════════════ */}
        {page==="patient" && <PatientView settings={settings} cases={cases} templates={templates} statsFor={statsFor} getTpl={getTpl} />}

        {/* ══════════════════════════════════════════════════════════════════════
            COLLEAGUE VIEW (password protected)
        ══════════════════════════════════════════════════════════════════════ */}
        {page==="colleague" && (()=>{
          const sv=settings.colleague||{};
          return (
            <div style={{maxWidth:960,margin:"0 auto"}}>
              <div style={{background:"linear-gradient(135deg,#0a1628,#0f2040)",border:"1px solid #1e3a5f",borderRadius:16,padding:"28px 34px",marginBottom:22}}>
                <div style={{fontSize:10,color:"#1e3a5f",letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:6}}>Clinical Outcomes Profile · General Surgery</div>
                <div style={{fontSize:24,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>{settings.surgeonName||"Surgeon Outcomes"}</div>
                <div style={{fontSize:12,color:"#334155"}}>{settings.tagline}</div>
                <div style={{display:"flex",gap:24,marginTop:16}}>{[[cases.length,"Total Cases Logged"],[tplStats.length,"Procedure Categories"],["ACS NSQIP","Benchmark Source"]].map(([v,l])=><div key={l}><div style={{fontSize:10,color:"#1e3a5f",textTransform:"uppercase",letterSpacing:"0.1em"}}>{l}</div><div style={{fontSize:18,fontWeight:700,color:"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}}>{v}</div></div>)}</div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                {sv.showComplications&&<KPI label="Overall Complication Rate" value={`${pct(overallStats.comps.length,overallStats.n)}%`} sub="Any Clavien-Dindo grade" color={overallStats.compPct>10?"#f59e0b":"#10b981"} />}
                {sv.showReadmission&&<KPI label="30d Readmission" value={`${pct(overallStats.readmits.length,overallStats.n)}%`} color={overallStats.readmitPct>8?"#f97316":"#10b981"} />}
                {sv.showMortality&&<KPI label="30d Mortality" value={`${pct(overallStats.deaths.length,overallStats.n)}%`} color={overallStats.deaths.length>0?"#ef4444":"#10b981"} />}
                {sv.showConversion&&<KPI label="MIS Rate" value={`${pct(overallStats.mis.length,overallStats.n)}%`} sub="Lap + Robotic" color="#38bdf8" />}
              </div>

              {/* Per-procedure clinical table */}
              <Card style={{marginBottom:16}}>
                <SecHd t="Outcomes by Procedure — vs ACS NSQIP" />
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{background:D.bg}}>
                      {["Procedure","n","Comp %","NSQIP",sv.showSSI&&"SSI %",sv.showSSI&&"NSQIP",sv.showConversion&&"Convert %","MIS %",sv.showLOS&&"Avg LOS",sv.showLOS&&"NSQIP LOS",sv.showCost&&"Avg Cost",sv.showCost&&"NSQIP"].filter(Boolean).map(h=><th key={h} style={th}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {tplStats.map(s=>{
                        const bench=NSQIP[s.tpl.id];
                        const G=(v,b)=>b!=null&&v!=null?(v<=b?"#10b981":"#ef4444"):"#94a3b8";
                        return (
                          <tr key={s.tpl.id} className="trh">
                            <td style={{...td,color:s.tpl.color,fontWeight:600}}>{s.tpl.emoji} {s.tpl.name}</td>
                            <td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{s.n}</td>
                            <td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:G(s.compPct,bench?.complications)}}>{pct(s.comps.length,s.n)}%</td>
                            <td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"#334155"}}>{bench?`${bench.complications}%`:"—"}</td>
                            {sv.showSSI&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{pct(s.n>0?cases.filter(c=>c.templateId===s.tpl.id&&c.custom.ssi&&c.custom.ssi!=="None").length:0,s.n)}%</td>}
                            {sv.showSSI&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"#334155"}}>{bench?`${bench.ssi}%`:"—"}</td>}
                            {sv.showConversion&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{pct(s.converts.length,s.n)}%</td>}
                            <td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"#38bdf8"}}>{pct(s.mis.length,s.n)}%</td>
                            {sv.showLOS&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:G(s.avgLOS,bench?.los)}}>{s.avgLOS.toFixed(1)}d</td>}
                            {sv.showLOS&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"#334155"}}>{bench?`${bench.los}d`:"—"}</td>}
                            {sv.showCost&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"#4ade80"}}>{s.avgCost>0?dollar(Math.round(s.avgCost)):"—"}</td>}
                            {sv.showCost&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"#334155"}}>{bench?dollar(bench.avgCost):"—"}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{fontSize:10,color:"#1e3a5f",marginTop:8}}>Green = at or below NSQIP benchmark. Benchmarks are approximate ACS NSQIP national averages.</div>
              </Card>

              {sv.showApproach&&(
                <Card style={{marginBottom:16}}>
                  <SecHd t="Operative Approach by Procedure" />
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                    {tplStats.map(s=>{
                      const apDist=[["Laparoscopic","#38bdf8"],["Robotic","#a78bfa"],["Open","#94a3b8"],["Converted","#f97316"]].map(([a,col])=>({name:a,count:cases.filter(c=>c.templateId===s.tpl.id&&(c.core.approach||"").includes(a)).length,color:col})).filter(x=>x.count>0);
                      return (
                        <div key={s.tpl.id} style={{padding:"12px 14px",background:D.bg,borderRadius:8,border:`1px solid ${D.border2}`}}>
                          <div style={{fontSize:12,fontWeight:600,color:s.tpl.color,marginBottom:8}}>{s.tpl.emoji} {s.tpl.name}</div>
                          {apDist.map(ap=>(
                            <div key={ap.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                              <div style={{width:60,fontSize:10,color:"#475569"}}>{ap.name}</div>
                              <div style={{flex:1,height:5,background:"#1e293b",borderRadius:3}}><div style={{width:`${(ap.count/s.n)*100}%`,height:"100%",background:ap.color,borderRadius:3}} /></div>
                              <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:"#334155",width:20,textAlign:"right"}}>{ap.count}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
              <div style={{background:"#0a1220",border:"1px solid #131f30",borderRadius:10,padding:"14px 18px",fontSize:11,color:"#1e3a5f",lineHeight:1.7}}><strong style={{color:"#334155"}}>Note:</strong> Data is self-reported and reflects personally logged cases. Benchmarks from ACS NSQIP are approximate national figures and do not constitute formal peer review. For detailed case-level data or referral enquiries, please contact directly.</div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════════
            HOSPITAL ADMIN VIEW (password protected)
        ══════════════════════════════════════════════════════════════════════ */}
        {page==="hospital" && (()=>{
          const sv=settings.hospital||{};
          const withCost=cases.filter(c=>c.core.cost>0);
          return (
            <div style={{maxWidth:960,margin:"0 auto"}}>
              <div style={{background:"linear-gradient(135deg,#0a1628,#0f2040)",border:"1px solid #1e3a5f",borderRadius:16,padding:"28px 34px",marginBottom:22}}>
                <div style={{fontSize:10,color:"#1e3a5f",letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:6}}>Hospital / Administrative View</div>
                <div style={{fontSize:24,fontWeight:700,color:"#f1f5f9",marginBottom:4}}>{settings.surgeonName||"Surgeon"} — Operative Performance</div>
                <div style={{fontSize:12,color:"#334155"}}>{settings.tagline}</div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                {sv.showVolume&&<KPI label="Total Cases" value={cases.length} sub={`${tplStats.length} procedure types`} />}
                {sv.showORTime&&<KPI label="Avg OR Time" value={`${Math.round(overallStats.avgOR)} min`} sub="All procedures" />}
                {sv.showLOS&&<KPI label="Avg Length of Stay" value={`${overallStats.avgLOS.toFixed(1)} days`} sub="Including day cases" />}
                {sv.showCost&&<KPI label="Avg Case Cost" value={dollar(Math.round(overallStats.avgCost))} sub={`Total: ${dollar(overallStats.totalCost)}`} color="#4ade80" />}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
                {sv.showReadmission&&<KPI label="30d Readmission" value={`${pct(overallStats.readmits.length,overallStats.n)}%`} color={overallStats.readmitPct>8?"#f97316":"#10b981"} sub={`${overallStats.readmits.length} cases`} />}
                {sv.showMortality&&<KPI label="30d Mortality" value={`${pct(overallStats.deaths.length,overallStats.n)}%`} color={overallStats.deaths.length>0?"#ef4444":"#10b981"} />}
                {sv.showConversion&&<KPI label="Conversion Rate" value={`${pct(overallStats.converts.length,overallStats.n)}%`} color={overallStats.convertPct>6?"#f59e0b":"#10b981"} />}
              </div>

              {/* Monthly cost + volume chart */}
              {sv.showCost&&sv.showVolume&&(
                <Card style={{marginBottom:16}}>
                  <SecHd t="Monthly Volume & Cost Trend" />
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthly}>
                      <XAxis dataKey="month" tick={{fontSize:11,fill:"#334155"}} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="l" tick={{fontSize:10,fill:"#334155"}} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="r" orientation="right" tick={{fontSize:10,fill:"#334155"}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}k`} />
                      <Tooltip contentStyle={{background:D.card,border:`1px solid ${D.border}`,borderRadius:8,fontSize:11}} formatter={(v,n)=>n==="Cost ($k)"?[`$${v.toFixed(1)}k`,n]:[v,n]} />
                      <Bar yAxisId="l" dataKey="cases" name="Cases" fill="#1d4ed8" radius={[4,4,0,0]} />
                      <Line yAxisId="r" type="monotone" dataKey="cost" name="Cost ($k)" stroke="#4ade80" strokeWidth={2} dot={{fill:"#4ade80",r:3}} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Per-procedure efficiency table */}
              <Card>
                <SecHd t="Efficiency by Procedure" />
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{background:D.bg}}>
                      {["Procedure","n",sv.showVolume&&"% of Volume",sv.showORTime&&"Avg OR (min)",sv.showLOS&&"Avg LOS",sv.showCost&&"Avg Cost",sv.showCost&&"Total Cost",sv.showReadmission&&"Readmit %",sv.showConversion&&"Conversion %"].filter(Boolean).map(h=><th key={h} style={th}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {tplStats.map(s=>(
                        <tr key={s.tpl.id} className="trh">
                          <td style={{...td,color:s.tpl.color,fontWeight:600}}>{s.tpl.emoji} {s.tpl.name}</td>
                          <td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{s.n}</td>
                          {sv.showVolume&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{pct(s.n,cases.length)}%</td>}
                          {sv.showORTime&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{Math.round(s.avgOR)}</td>}
                          {sv.showLOS&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{s.avgLOS.toFixed(1)}d</td>}
                          {sv.showCost&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"#4ade80"}}>{s.avgCost>0?dollar(Math.round(s.avgCost)):"—"}</td>}
                          {sv.showCost&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:"#4ade80"}}>{s.totalCost>0?dollar(s.totalCost):"—"}</td>}
                          {sv.showReadmission&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace",color:s.readmitPct>8?"#f97316":"#10b981"}}>{pct(s.readmits.length,s.n)}%</td>}
                          {sv.showConversion&&<td style={{...td,fontFamily:"'JetBrains Mono',monospace"}}>{pct(s.converts.length,s.n)}%</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
