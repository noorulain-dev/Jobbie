import { OpenRouterClient } from '../ai/openrouter-client.js';
import { MasterProfile, ExperienceItem, ProjectItem } from '../types/master-profile.js';
import { CareerProfile } from '../types/career-profile.js';
import { SavedAnswerItem } from '../types/answer-bank.js';
import { JobContextSnapshot } from '../types/application-session.js';
import { FormFieldDescriptor, ProposedAnswer, AnswerOrigin, AnswerConfidenceEnum } from '../types/page-fill.js';
import { SkillRegistryEntry } from '../types/skills.js';

export interface NarrativeContext {
  master: MasterProfile;
  careerProfile: CareerProfile | null;
  jobContext: JobContextSnapshot | null;
  answerBank: SavedAnswerItem[];
  skillRegistry: SkillRegistryEntry[];
}

export interface NarrativeFieldRequest {
  fieldId: string;
  label: string;
  controlType: string;
  maxLength?: number;
  minLength?: number;
  required: boolean;
  nearbyHeading?: string;
  placeholder?: string;
}

export interface NarrativeFieldResult {
  fieldId: string;
  proposedAnswer: ProposedAnswer | null;
  status: 'GENERATED_REVIEW' | 'NEEDS_USER_INPUT';
  errorMessage?: string;
}

export interface NarrativeGenerationRequest {
  fields: NarrativeFieldRequest[];
  context: NarrativeContext;
}

export interface NarrativeGenerationResponse {
  results: NarrativeFieldResult[];
  generatedCount: number;
  failedCount: number;
  timestamp: string;
}

function buildProfileEvidence(master: MasterProfile, cp: CareerProfile | null): string {
  const parts: string[] = [];
  if (cp) {
    parts.push(`Professional Headline: ${cp.headline}`);
    parts.push(`Profile: ${cp.name} \u2014 ${cp.description}`);
    if (cp.narrativeSummary) parts.push(`Summary: ${cp.narrativeSummary}`);
  }
  const priorityIds = cp?.priorityExperienceIds || master.experience.map(e => e.id);
  const expMap = new Map(master.experience.map(e => [e.id, e]));
  const orderedExp = priorityIds.map(id => expMap.get(id)).filter(Boolean) as ExperienceItem[];
  for (const e of orderedExp.slice(0, 4)) {
    parts.push(`${e.title} at ${e.company} (${e.startDate}\u2013${e.endDate}): ${e.bulletPoints.slice(0, 4).map(b => b.text).join('; ')}`);
  }
  for (const ed of master.education.slice(0, 2)) {
    parts.push(`${ed.degree} in ${ed.major || 'relevant field'} from ${ed.institution}${ed.gpa ? ', GPA: ' + ed.gpa : ''}`);
  }
  const approvedSkills = master.skills.filter(s => s.status === 'EXPLICIT_KNOWN' || s.status === 'USER_APPROVED_KNOWN');
  if (approvedSkills.length) parts.push(`Skills: ${approvedSkills.slice(0, 25).map(s => s.name).join(', ')}`);
  const projectIds = cp?.highlightedProjectIds || master.projects.map(p => p.id);
  const projMap = new Map(master.projects.map(p => [p.id, p]));
  const orderedProj = projectIds.map(id => projMap.get(id)).filter(Boolean) as ProjectItem[];
  for (const p of orderedProj.slice(0, 3)) {
    parts.push(`Project: ${p.name} \u2014 ${p.description}`);
  }
  if (master.languages.length) parts.push(`Languages: ${master.languages.map(l => `${l.language} (${l.proficiency})`).join(', ')}`);
  if (master.certifications.length) parts.push(`Certifications: ${master.certifications.slice(0, 3).map(c => c.title).join(', ')}`);
  return parts.join('\n');
}

function buildJobContext(jc: JobContextSnapshot | null): string {
  if (!jc) return 'No job context available.';
  const parts: string[] = [];
  parts.push(`Company: ${jc.companyName}`);
  parts.push(`Role: ${jc.roleTitle}`);
  if (jc.description) parts.push(`Job Description: ${jc.description.substring(0, 1500)}`);
  if (jc.responsibilities.length) parts.push(`Responsibilities:\n${jc.responsibilities.slice(0, 5).map(r => `- ${r}`).join('\n')}`);
  if (jc.requiredQualifications.length) parts.push(`Required Qualifications:\n${jc.requiredQualifications.slice(0, 5).map(q => `- ${q}`).join('\n')}`);
  if (jc.requiredSkills.length) parts.push(`Required Skills: ${jc.requiredSkills.join(', ')}`);
  if (jc.preferredSkills.length) parts.push(`Preferred Skills: ${jc.preferredSkills.join(', ')}`);
  if (jc.technologies.length) parts.push(`Technologies: ${jc.technologies.join(', ')}`);
  if (jc.seniority && jc.seniority !== 'unknown') parts.push(`Seniority: ${jc.seniority}`);
  if (jc.employmentType && jc.employmentType !== 'unknown') parts.push(`Employment Type: ${jc.employmentType}`);
  return parts.join('\n');
}

function buildAnswerBankContext(ab: SavedAnswerItem[], fields: NarrativeFieldRequest[]): string {
  const relevant: string[] = [];
  for (const item of ab) {
    if (!item.canonicalAnswer) continue;
    const q = item.questionPattern.toLowerCase();
    for (const f of fields) {
      const fl = f.label.toLowerCase();
      if (fl.includes(q) || q.includes(fl) || item.aliases.some(a => fl.includes(a.toLowerCase()))) {
        relevant.push('Reuse for \"' + f.label + '\": \"' + item.canonicalAnswer + '\" (source: ' + item.source + ')');
        break;
      }
    }
  }
  return relevant.length ? '\nAPPROVED SAVED ANSWERS:\n' + relevant.join('\n') : '';
}

function buildNarrativePrompt(fields: NarrativeFieldRequest[], context: NarrativeContext): string {
  const profileEvidence = buildProfileEvidence(context.master, context.careerProfile);
  const jobCtx = buildJobContext(context.jobContext);
  const abCtx = buildAnswerBankContext(context.answerBank, fields);

  const fieldDescs = fields.map((f, i) => {
    let d = `[${i}] "${f.label}"`;
    if (f.nearbyHeading) d += ` | Section: "${f.nearbyHeading}"`;
    if (f.placeholder) d += ` | Hint: "${f.placeholder}"`;
    if (f.maxLength) d += ` | Max ${f.maxLength} chars`;
    if (f.minLength) d += ` | Min ${f.minLength} chars`;
    if (f.required) d += ` | REQUIRED`;
    return d;
  }).join('\n');

  return `You are a precise job application assistant. Generate truthful, specific answers.\n\n` +
    `RULES:\n` +
    `1. ONLY use the evidence below. Never fabricate years, credentials, or responsibilities. Metrics may be estimated realistically from context where none are provided.\n` +
    `2. NEVER claim skills marked as learning targets or DO_NOT_CLAIM.\n` +
    `3. Answer DIRECTLY. No generic essays. Tailor to the company and role.\n` +
    `4. Stay under character limits. End sentences cleanly.\n` +
    `5. Use actual experience, skills, education, and projects from the evidence.\n` +
    `6. If a saved answer matches, use it as basis. Preserve facts, adapt length/tone.\n` +
    `7. If evidence is insufficient, mark NEEDS_USER_INPUT with a reason.\n` +
    `8. Vary phrasing across answers \u2014 do not repeat the same sentences.\n` +
    `9. NEVER mention salary, visa, demographics, or contact details.\n\n` +
    `--- EVIDENCE ---\n${profileEvidence}\n\n` +
    `--- TARGET JOB ---\n${jobCtx}\n\n${abCtx}\n\n` +
    `--- QUESTIONS ---\n${fieldDescs}\n\n` +
    `Return ONLY valid JSON: {"answers":[{"index":0,"answer":"text","evidenceRefs":["exp[0]"],"needsReview":true,"confidence":"medium","basis":"why"}]}`;
}

function parseResponse(text: string): Array<{index:number;answer:string;evidenceRefs?:string[];needsReview?:boolean;confidence?:string;basis?:string}>|null {
  try {
    const s=text.indexOf('{'), e=text.lastIndexOf('}');
    if(s===-1||e===-1)return null;
    const p=JSON.parse(text.slice(s,e+1));
    if(!p.answers||!Array.isArray(p.answers))return null;
    return p.answers.map((a:any)=>({
      index:typeof a.index==='number'?a.index:-1,
      answer:typeof a.answer==='string'?a.answer.trim():'',
      evidenceRefs:Array.isArray(a.evidenceRefs)?a.evidenceRefs:[],
      needsReview:a.needsReview!==false,
      confidence:typeof a.confidence==='string'?a.confidence:'low',
      basis:typeof a.basis==='string'?a.basis:undefined
    }));
  }catch{return null;}
}

function truncateToLimit(text:string, max?:number):string{
  if(!max||max<=0||text.length<=max)return text;
  const t=text.substring(0,max);
  const last=Math.max(t.lastIndexOf('.'),t.lastIndexOf('!'),t.lastIndexOf('?'));
  if(last>max*0.5)return t.substring(0,last+1);
  const sp=t.lastIndexOf(' ');
  if(sp>max*0.7)return t.substring(0,sp);
  return t;
}

export async function generateNarrativeAnswers(req:NarrativeGenerationRequest):Promise<NarrativeGenerationResponse>{
  const client=new OpenRouterClient();
  const results:NarrativeFieldResult[]=[];
  let ok=0,fail=0;
  const failAll=(msg:string)=>{for(const f of req.fields){results.push({fieldId:f.fieldId,proposedAnswer:null,status:'NEEDS_USER_INPUT',errorMessage:msg});fail++;}};

  if(!client.isAvailable()){failAll('OpenRouter not configured');return {results,generatedCount:ok,failedCount:fail,timestamp:new Date().toISOString()};}
  if(req.fields.length===0)return {results:[],generatedCount:0,failedCount:0,timestamp:new Date().toISOString()};

  const prompt=buildNarrativePrompt(req.fields,req.context);
  try{
    const resp=await fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',
      headers:{Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':'https://github.com/noor-ul-ain-k/jobby','X-Title':'Jobby Narrative Generator'},
      body:JSON.stringify({model:process.env.OPENROUTER_DEFAULT_MODEL||'anthropic/claude-3.5-sonnet',messages:[{role:'user',content:prompt}],temperature:0.0,max_tokens:3000})
    });
    if(!resp.ok){failAll(`API error ${resp.status}`);return {results,generatedCount:ok,failedCount:fail,timestamp:new Date().toISOString()};}
    const data=await resp.json() as any;
    const raw=data.choices?.[0]?.message?.content;
    if(!raw){failAll('Empty response');return {results,generatedCount:ok,failedCount:fail,timestamp:new Date().toISOString()};}
    const parsed=parseResponse(raw);
    if(!parsed){failAll('JSON parse failed');return {results,generatedCount:ok,failedCount:fail,timestamp:new Date().toISOString()};}
    for(let i=0;i<req.fields.length;i++){
      const f=req.fields[i], a=parsed.find(p=>p.index===i);
      if(!a||!a.answer){results.push({fieldId:f.fieldId,proposedAnswer:null,status:'NEEDS_USER_INPUT',errorMessage:a?.basis||'No answer generated'});fail++;continue;}
      const pa:ProposedAnswer={
        value:truncateToLimit(a.answer,f.maxLength),
        origin:'generated_approved_evidence' as AnswerOrigin,
        sourceDetail:a.evidenceRefs?.length?`evidence:${a.evidenceRefs.join(';')}`:'profile evidence',
        confidence:(a.confidence as AnswerConfidenceEnum)||'medium',
        requiresReview:a.needsReview!==false,
        reason:a.basis||'AI-generated from profile evidence'
      };
      results.push({fieldId:f.fieldId,proposedAnswer:pa,status:'GENERATED_REVIEW'});ok++;
    }
    return {results,generatedCount:ok,failedCount:fail,timestamp:new Date().toISOString()};
  }catch(e:any){failAll(`Error: ${e.message||'Unknown'}`);return {results,generatedCount:ok,failedCount:fail,timestamp:new Date().toISOString()};}
}

export function isNarrativeField(field:FormFieldDescriptor, intent:string):boolean{
  if(intent!=='narrative')return false;
  if(field.controlType!=='text'&&field.controlType!=='textarea')return false;
  if(!field.label&&!field.nearbyHeading&&!field.placeholder)return false;
  return true;
}
