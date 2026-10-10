let state = {
  masterProfile: null,
  careerProfiles: [],
  activeCareerProfileId: null,
  skillRegistry: [],
  inferredPending: [],
  currentSkillFilter: 'ALL',
  answerBank: [],
  history: []
};

async function init() {
  await loadMasterProfile();
  await loadCareerProfiles();
  await loadSkillIntelligence();
  await loadAnswerBank();
  await loadHistory();
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 2500);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  
  const tabIdx = ['master', 'career', 'skills', 'answers', 'history'].indexOf(tabName);
  if (tabIdx >= 0) {
    document.querySelectorAll('.tab-btn')[tabIdx].classList.add('active');
  }
  document.getElementById('tab-' + tabName).classList.add('active');
  if (tabName === 'history') {
    loadHistory();
  }
}

// 1. MASTER PROFILE LOAD & RENDER
async function loadMasterProfile() {
  const res = await fetch('/api/master-profile');
  if (!res.ok) return;
  state.masterProfile = await res.json();
  renderMasterProfile();
}

function renderMasterProfile() {
  const m = state.masterProfile;
  if (!m) return;

  // Personal
  document.getElementById('p_firstName').value = m.personal.firstName || '';
  document.getElementById('p_lastName').value = m.personal.lastName || '';
  document.getElementById('p_email').value = m.personal.email || '';
  document.getElementById('p_phone').value = m.personal.phone || '';
  document.getElementById('p_city').value = m.personal.city || '';
  document.getElementById('p_provinceState').value = m.personal.provinceState || '';
  document.getElementById('p_country').value = m.personal.country || '';

  // Contact Links
  document.getElementById('p_linkedin').value = m.personal.linkedin || '';
  document.getElementById('p_github').value = m.personal.github || '';
  document.getElementById('p_portfolio').value = m.personal.portfolio || '';

  // Screening
  document.getElementById('s_workAuth').value = m.screening.workAuthorization || '';
  document.getElementById('s_sponsorship').value = m.screening.sponsorshipRequired || '';
  document.getElementById('s_salary').value = m.screening.targetSalary || '';
  document.getElementById('s_notice').value = m.screening.noticePeriod || '';
  document.getElementById('s_experience').value = m.screening.yearsExperience || '';
  document.getElementById('s_remote').value = m.screening.remoteEligibility || '';

  // Experience
  document.getElementById('expCountBadge').textContent = m.experience.length;
  document.getElementById('experienceList').innerHTML = m.experience.map(e => `
    <div class="list-item">
      <div class="list-item-header">
        <div>
          <div class="list-item-title">${escapeHtml(e.company)}</div>
          <div class="subtext">${escapeHtml(e.title)} • ${escapeHtml(e.startDate)} - ${escapeHtml(e.endDate || 'Present')} • ${escapeHtml(e.location)}</div>
        </div>
        <span class="tag tag-blue">${escapeHtml(e.employmentType || 'Full-time')}</span>
      </div>
      <ul style="padding-left: 1.2rem; margin-top: 0.5rem; font-size: 0.85rem; color: var(--text);">
        ${e.bulletPoints.map(b => `<li style="margin-bottom: 0.25rem;">${escapeHtml(b.text)}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  // Projects
  document.getElementById('projCountBadge').textContent = m.projects.length;
  document.getElementById('projectsList').innerHTML = m.projects.map(p => `
    <div class="list-item">
      <div class="list-item-header">
        <div class="list-item-title">${escapeHtml(p.name)}</div>
        ${p.url ? `<a href="${escapeHtml(p.url)}" target="_blank" style="color: var(--primary); font-size: 0.8rem; text-decoration: none;">View ↗</a>` : ''}
      </div>
      <div class="subtext" style="margin-bottom: 0.5rem;">${escapeHtml(p.description)}</div>
      <div>${p.technologies.map(t => `<span class="tag tag-gray">${escapeHtml(t)}</span>`).join('')}</div>
    </div>
  `).join('');

  // Education
  document.getElementById('educationList').innerHTML = m.education.map(edu => `
    <div class="list-item">
      <div class="list-item-title">${escapeHtml(edu.degree)}${edu.major ? ` (${escapeHtml(edu.major)})` : ''}</div>
      <div class="subtext">${escapeHtml(edu.institution)} • ${escapeHtml(edu.location)} • Status: ${escapeHtml(edu.status)}</div>
    </div>
  `).join('');

  // Certifications
  document.getElementById('certList').innerHTML = m.certifications.map(c => `
    <div class="list-item">
      <div class="list-item-title">${escapeHtml(c.title)}</div>
      <div class="subtext">${escapeHtml(c.issuer || '')} • ${escapeHtml(c.year)}</div>
    </div>
  `).join('');

  // Awards
  document.getElementById('awardsList').innerHTML = m.awards.map(a => `
    <div class="list-item">
      <div class="list-item-title">${escapeHtml(a.title)}</div>
      <div class="subtext">${escapeHtml(a.year || '')} ${a.issuer ? '• ' + escapeHtml(a.issuer) : ''}</div>
    </div>
  `).join('');

  // Leadership
  document.getElementById('leadershipList').innerHTML = (m.leadership || []).map(l => `
    <div class="list-item">
      <div class="list-item-title">${escapeHtml(l.role)}</div>
      <div class="subtext">${escapeHtml(l.organization || '')} • ${escapeHtml(l.dates || '')}</div>
    </div>
  `).join('');

  // Languages
  document.getElementById('languagesList').innerHTML = (m.languages || []).map(lang => `
    <div class="list-item" style="display: flex; justify-content: space-between; align-items: center;">
      <div class="list-item-title">${escapeHtml(lang.language)}</div>
      <span class="tag tag-blue">${escapeHtml(lang.proficiency)}</span>
    </div>
  `).join('');
}
async function saveMasterProfile() {
  if (!state.masterProfile) return;
  const m = state.masterProfile;

  m.personal.firstName = document.getElementById('p_firstName').value.trim();
  m.personal.lastName = document.getElementById('p_lastName').value.trim();
  m.personal.email = document.getElementById('p_email').value.trim();
  m.personal.phone = document.getElementById('p_phone').value.trim();
  m.personal.city = document.getElementById('p_city').value.trim();
  m.personal.provinceState = document.getElementById('p_provinceState').value.trim();
  m.personal.country = document.getElementById('p_country').value.trim();

  m.personal.linkedin = document.getElementById('p_linkedin').value.trim();
  m.personal.github = document.getElementById('p_github').value.trim();
  m.personal.portfolio = document.getElementById('p_portfolio').value.trim();

  m.screening.workAuthorization = document.getElementById('s_workAuth').value.trim();
  m.screening.sponsorshipRequired = document.getElementById('s_sponsorship').value.trim();
  m.screening.targetSalary = document.getElementById('s_salary').value.trim();
  m.screening.noticePeriod = document.getElementById('s_notice').value.trim();
  m.screening.yearsExperience = document.getElementById('s_experience').value.trim();
  m.screening.remoteEligibility = document.getElementById('s_remote').value.trim();
  m.lastUpdated = new Date().toISOString();

  const res = await fetch('/api/master-profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(m)
  });

  if (res.ok) {
    showToast('Master Profile saved successfully!');
    await loadMasterProfile();
  } else {
    const err = await res.json();
    alert('Error saving profile: ' + (err.error || 'Failed'));
  }
}
// 2. CAREER PROFILES
async function loadCareerProfiles() {
  const res = await fetch('/api/career-profiles');
  if (!res.ok) return;
  state.careerProfiles = await res.json();
  if (!state.activeCareerProfileId && state.careerProfiles.length > 0) {
    state.activeCareerProfileId = state.careerProfiles[0].id;
  }
  renderCareerProfiles();
}

function renderCareerProfiles() {
  const tabsContainer = document.getElementById('careerProfileTabs');
  tabsContainer.innerHTML = state.careerProfiles.map(p => `
    <button class="profile-tab-btn ${p.id === state.activeCareerProfileId ? 'active' : ''}" onclick="selectCareerProfile('${p.id}')">
      ${escapeHtml(p.name)}
    </button>
  `).join('');

  const activeProfile = state.careerProfiles.find(p => p.id === state.activeCareerProfileId);
  if (!activeProfile) return;

  const m = state.masterProfile;
  const primarySkills = m ? m.skills.filter(s => activeProfile.primarySkillIds.includes(s.id)) : [];
  const priorityExp = m ? m.experience.filter(e => activeProfile.priorityExperienceIds.includes(e.id)) : [];
  const highlightedProj = m ? m.projects.filter(p => activeProfile.highlightedProjectIds.includes(p.id)) : [];

  document.getElementById('careerProfileContent').innerHTML = `
    <div class="card">
      <div class="card-title">
        <span>🎯 ${escapeHtml(activeProfile.name)}</span>
        <span class="tag tag-blue">${escapeHtml(activeProfile.track)}</span>
      </div>
      <div class="subtext" style="font-size: 0.95rem; margin-bottom: 1rem;">${escapeHtml(activeProfile.headline)}</div>
      <p style="margin-bottom: 1rem; color: var(--text);">${escapeHtml(activeProfile.narrativeSummary)}</p>

      <div class="grid-2">
        <div class="form-group">
          <label>Target Job Roles</label>
          <div>${activeProfile.targetJobTitles.map(t => `<span class="tag tag-green">${escapeHtml(t)}</span>`).join('')}</div>
        </div>
        <div class="form-group">
          <label>Strategic Keywords</label>
          <div>${activeProfile.preferredKeywords.map(k => `<span class="tag tag-purple">${escapeHtml(k)}</span>`).join('')}</div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">⭐ Prioritized Skills (${primarySkills.length})</div>
        <div>${primarySkills.map(s => `<span class="tag tag-blue">${escapeHtml(s.name)}</span>`).join('')}</div>
      </div>

      <div class="card">
        <div class="card-title">⚙ Preferences & Constraints</div>
        <div class="subtext" style="margin-bottom: 0.4rem;"><strong>Target Salary:</strong> ${escapeHtml(activeProfile.salaryPreferences?.target || 'Default')}</div>
        <div class="subtext" style="margin-bottom: 0.4rem;"><strong>Locations:</strong> ${(activeProfile.locationPreferences?.allowedCountries || []).join(', ')}</div>
        <div class="subtext" style="margin-bottom: 0.4rem;"><strong>Remote Preference:</strong> ${activeProfile.remotePreferences?.hybridAllowed ? 'Hybrid Allowed' : 'Strict Remote'}</div>
        <div class="subtext"><strong>Seniority Claim:</strong> ${(activeProfile.seniorityPreferences?.targetLevels || []).join(', ')} (${activeProfile.seniorityPreferences?.yearsExperienceClaim || ''})</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">💼 Prioritized Work Experience (${priorityExp.length})</div>
        ${priorityExp.map(e => `
          <div class="list-item">
            <div class="list-item-title">${escapeHtml(e.company)} - ${escapeHtml(e.title)}</div>
            <div class="subtext">${escapeHtml(e.startDate)} - ${escapeHtml(e.endDate || 'Present')}</div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="card-title">🚀 Prioritized Projects (${highlightedProj.length})</div>
        ${highlightedProj.map(p => `
          <div class="list-item">
            <div class="list-item-title">${escapeHtml(p.name)}</div>
            <div class="subtext">${escapeHtml(p.description)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function selectCareerProfile(id) {
  state.activeCareerProfileId = id;
  renderCareerProfiles();
}
// 3. SKILL INTELLIGENCE
async function loadSkillIntelligence() {
  const res = await fetch('/api/skill-intelligence');
  if (!res.ok) return;
  const data = await res.json();
  state.skillRegistry = data.registry || [];
  state.inferredPending = data.inferredPending || [];
  renderSkillIntelligence();
}

function renderSkillIntelligence() {
  const knownCount = state.skillRegistry.filter(s => s.status === 'EXPLICIT_KNOWN').length;
  const approvedCount = state.skillRegistry.filter(s => s.status === 'USER_APPROVED_KNOWN').length;
  const pendingCount = state.inferredPending.length;
  const learningCount = state.skillRegistry.filter(s => s.status === 'LEARNING_TARGET').length;
  const prohibitedCount = state.skillRegistry.filter(s => s.status === 'DO_NOT_CLAIM').length;

  document.getElementById('count_all').textContent = state.skillRegistry.length + pendingCount;
  document.getElementById('count_known').textContent = knownCount;
  document.getElementById('count_approved').textContent = approvedCount;
  document.getElementById('count_pending').textContent = pendingCount;
  document.getElementById('count_learning').textContent = learningCount;
  document.getElementById('count_prohibited').textContent = prohibitedCount;

  // Pending banner
  const banner = document.getElementById('pendingReviewBanner');
  if (pendingCount > 0) {
    banner.style.display = 'block';
    document.getElementById('pendingReviewList').innerHTML = state.inferredPending.map((sug, idx) => `
      <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="color: #f8fafc;">${escapeHtml(sug.canonicalName)}</strong>
          <span class="tag tag-purple" style="margin-left: 0.5rem;">${escapeHtml(sug.category)}</span>
          <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 0.25rem;">Rationale: ${escapeHtml(sug.rationale)}</div>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-success" style="padding: 0.35rem 0.6rem; font-size: 0.75rem;" onclick="approveInferredSkill(${idx})">Approve</button>
        </div>
      </div>
    `).join('');
  } else {
    banner.style.display = 'none';
  }

  // Filtered table
  let filtered = state.skillRegistry;
  if (state.currentSkillFilter !== 'ALL') {
    filtered = state.skillRegistry.filter(s => s.status === state.currentSkillFilter);
  }

  const tbody = document.getElementById('skillsTableBody');
  tbody.innerHTML = filtered.map(s => {
    let statusBadge = '<span class="tag tag-blue">Known</span>';
    if (s.status === 'USER_APPROVED_KNOWN') statusBadge = '<span class="tag tag-green">User-Approved</span>';
    if (s.status === 'LEARNING_TARGET') statusBadge = '<span class="tag tag-yellow">Learning Target</span>';
    if (s.status === 'DO_NOT_CLAIM') statusBadge = '<span class="tag tag-red">Never Claim</span>';

    return `
      <tr>
        <td><strong>${escapeHtml(s.canonicalName)}</strong></td>
        <td><span class="tag tag-gray">${escapeHtml(s.category)}</span></td>
        <td>${statusBadge}</td>
        <td>${(s.aliases || []).map(a => `<span class="tag tag-gray">${escapeHtml(a)}</span>`).join('')}</td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${(s.evidence || []).map(e => escapeHtml(e.description)).join('<br>') || s.source}</td>
        <td>
          <select class="form-control" style="width: auto; padding: 0.3rem 0.5rem; font-size: 0.75rem;" onchange="changeSkillStatus('${s.id}', this.value)">
            <option value="EXPLICIT_KNOWN" ${s.status === 'EXPLICIT_KNOWN' ? 'selected' : ''}>Known</option>
            <option value="USER_APPROVED_KNOWN" ${s.status === 'USER_APPROVED_KNOWN' ? 'selected' : ''}>User-Approved</option>
            <option value="LEARNING_TARGET" ${s.status === 'LEARNING_TARGET' ? 'selected' : ''}>Learning Target</option>
            <option value="DO_NOT_CLAIM" ${s.status === 'DO_NOT_CLAIM' ? 'selected' : ''}>Never Claim</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

function filterSkills(status) {
  state.currentSkillFilter = status;
  document.querySelectorAll('#tab-skills .profile-tab-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  renderSkillIntelligence();
}

async function approveInferredSkill(idx) {
  const suggestion = state.inferredPending[idx];
  if (!suggestion) return;

  const res = await fetch('/api/skill-intelligence/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suggestion })
  });

  if (res.ok) {
    showToast(`Approved "${suggestion.canonicalName}"`);
    await loadMasterProfile();
    await loadSkillIntelligence();
  }
}

async function changeSkillStatus(skillId, newStatus) {
  const res = await fetch('/api/skill-intelligence/update-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId, newStatus })
  });

  if (res.ok) {
    showToast('Skill status updated');
    await loadMasterProfile();
    await loadSkillIntelligence();
  }
}
// 4. APPLICATION ANSWER BANK
async function loadAnswerBank() {
  const res = await fetch('/api/answer-bank');
  if (!res.ok) return;
  state.answerBank = await res.json();
  renderAnswerBank();
}

function renderAnswerBank() {
  const tbody = document.getElementById('answerBankTableBody');
  tbody.innerHTML = state.answerBank.map((item, idx) => `
    <tr>
      <td>
        <strong>${escapeHtml(item.questionPattern)}</strong>
        ${item.aliases?.length ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Aliases: ${item.aliases.map(escapeHtml).join(', ')}</div>` : ''}
      </td>
      <td>
        <input type="text" class="form-control" value="${escapeHtml(item.canonicalAnswer)}" onchange="updateAnswer(${idx}, this.value)">
      </td>
      <td>
        <span class="tag tag-gray">${escapeHtml(item.category)}</span>
        <span class="tag tag-blue">${escapeHtml(item.responseType)}</span>
      </td>
      <td><span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(item.source)}</span></td>
      <td>
        <span class="tag ${item.confidence === 'high' ? 'tag-green' : 'tag-yellow'}">${escapeHtml(item.confidence || 'high')}</span>
      </td>
      <td><strong>${item.usageCount || 0}</strong></td>
      <td style="font-size: 0.8rem; color: var(--text-muted);">${item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString() : 'Never'}</td>
      <td>
        <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="saveAnswerItem(${idx})">Save</button>
      </td>
    </tr>
  `).join('');
}

function updateAnswer(idx, newVal) {
  if (state.answerBank[idx]) {
    state.answerBank[idx].canonicalAnswer = newVal;
  }
}

async function saveAnswerItem(idx) {
  const item = state.answerBank[idx];
  if (!item) return;

  const res = await fetch('/api/answer-bank/' + item.id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });

  if (res.ok) {
    showToast('Saved answer updated');
    await loadAnswerBank();
  }
}

async function openNewAnswerModal() {
  const question = prompt('Enter application question:');
  if (!question) return;
  const answer = prompt('Enter canonical answer:');
  if (!answer) return;

  const newItem = {
    id: crypto.randomUUID(),
    questionPattern: question.trim(),
    aliases: [],
    category: 'general',
    responseType: 'free_text',
    canonicalAnswer: answer.trim(),
    safeToAutoSubmit: true,
    requiresHumanConfirmation: false,
    source: 'user_confirmed',
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const res = await fetch('/api/answer-bank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newItem)
  });

  if (res.ok) {
    showToast('Added new answer to bank');
    await loadAnswerBank();
  }
}

// 5. IMPORT / EXPORT (Zero Secret Leakage)
function exportData() {
  window.location.href = '/api/export';
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });

      if (res.ok) {
        showToast('Profile imported successfully!');
        await init();
      } else {
        const err = await res.json();
        alert('Import error: ' + (err.error || 'Failed'));
      }
    } catch (err) {
      alert('Invalid JSON file format.');
    }
  };
  reader.readAsText(file);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
// 6. VERSION HISTORY & ROLLBACK
async function loadHistory() {
  const res = await fetch('/api/history');
  if (!res.ok) return;
  state.history = await res.json();
  renderHistory();
}

function renderHistory() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  if (state.history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No version history entries recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = state.history.map(item => {
    let sourceBadge = `<span class="tag tag-blue">${escapeHtml(item.changeSource)}</span>`;
    if (item.changeSource === 'RESUME_IMPORT') sourceBadge = `<span class="tag tag-green">${escapeHtml(item.changeSource)}</span>`;
    if (item.changeSource === 'USER_APPROVED_INFERENCE') sourceBadge = `<span class="tag tag-purple">${escapeHtml(item.changeSource)}</span>`;
    if (item.changeSource === 'SYSTEM_GENERATED_SUGGESTION') sourceBadge = `<span class="tag tag-yellow">${escapeHtml(item.changeSource)}</span>`;

    const diffCount = item.fieldsChanged ? item.fieldsChanged.length : 0;
    const diffTooltip = item.fieldsChanged
      ? item.fieldsChanged.map(d => `${d.action}: ${d.fieldPath}`).slice(0, 5).join(', ')
      : '';

    return `
      <tr>
        <td><strong>#${item.versionNumber || item.id}</strong></td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(item.timestamp).toLocaleString()}</td>
        <td>${sourceBadge}</td>
        <td><span class="tag tag-gray">${escapeHtml(item.actor)}</span></td>
        <td>${escapeHtml(item.changeReason)}</td>
        <td>
          <span class="tag tag-gray" title="${escapeHtml(diffTooltip)}">${diffCount} field(s)</span>
        </td>
        <td>
          <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="rollbackVersion(${item.id}, ${item.versionNumber})">Restore</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function rollbackVersion(historyId, versionNum) {
  const confirmed = confirm(`Are you sure you want to rollback Master Profile to version #${versionNum}? Current changes will be snapshotted as a new version entry.`);
  if (!confirmed) return;

  const res = await fetch('/api/history/rollback/' + historyId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: `User restored version #${versionNum}` })
  });

  if (res.ok) {
    showToast(`Restored to version #${versionNum}!`);
    await loadMasterProfile();
    await loadHistory();
  } else {
    const err = await res.json();
    alert('Rollback error: ' + (err.error || 'Failed'));
  }
}


window.addEventListener('DOMContentLoaded', init);




