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
  
  var tabIdx = ['master', 'career', 'skills', 'answers', 'history', 'sessions', 'tracker'].indexOf(tabName);
  if (tabIdx >= 0) {
    document.querySelectorAll('.tab-btn')[tabIdx].classList.add('active');
  }
  document.getElementById('tab-' + tabName).classList.add('active');
  if (tabName === 'history') {
    loadHistory();
  }
  if (tabName === 'sessions') {
    loadSessions();
  }
  if (tabName === 'tracker') {
    loadTracker();
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


// 7. APPLICATION SESSIONS
async function loadSessions() {
  const res = await fetch('/api/sessions');
  if (!res.ok) return;
  const sessions = await res.json();
  renderSessionsTable(sessions);
}

function renderSessionsTable(sessions) {
  const tbody = document.getElementById('sessionsTableBody');
  if (!tbody) return;
  if (!sessions || sessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:16px;color:#6c757d">No application sessions yet.</td></tr>';
    return;
  }
  tbody.innerHTML = sessions.map(function(s) {
    var ss = s.jobContextSnapshot;
    return '<tr>' +
      '<td>' + escHtml(ss.companyName) + '</td>' +
      '<td>' + escHtml(ss.roleTitle) + '</td>' +
      '<td><span class="status-badge status-' + s.status.toLowerCase() + '">' + s.status + '</span></td>' +
      '<td>' + (s.associatedPages ? s.associatedPages.length : 0) + '</td>' +
      '<td>' + escHtml(s.selectedCareerProfileId || 'auto') + '</td>' +
      '<td>' + escHtml((s.lastActivityAt || '').slice(0, 10)) + '</td>' +
      '<td>' +
        (s.status === 'PAUSED' ? '<button class="btn btn-success btn-sm" onclick="sessionAction(\'' + s.id + '\',\'resume\')">Resume</button> ' : '') +
        (s.status === 'ACTIVE' ? '<button class="btn btn-warning btn-sm" onclick="sessionAction(\'' + s.id + '\',\'pause\')">Pause</button> ' : '') +
        ((s.status === 'ACTIVE' || s.status === 'PAUSED') ? '<button class="btn btn-danger btn-sm" onclick="sessionAction(\'' + s.id + '\',\'cancel\')">Cancel</button>' : '') +
      '</td>' +
    '</tr>';
  }).join('');
}

async function sessionAction(id, action) {
  var statusMap = { resume: 'ACTIVE', pause: 'PAUSED', cancel: 'CANCELLED' };
  var res = await fetch('/api/sessions/' + id + '/status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: statusMap[action] })
  });
  if (res.ok) { loadSessions(); showToast('Session ' + action + 'd'); }
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

var currentViewSessionId = null;

async function viewSession(id) {
  currentViewSessionId = id;
  document.getElementById('session-detail').style.display = 'block';
  var content = document.getElementById('session-detail-content');
  content.innerHTML = '<div style="padding:12px;color:#6c757d">Loading...</div>';
  var ctxRes = await fetch('/api/sessions/' + id + '/effective-context');
  var profRes = await fetch('/api/career-profiles');
  var ctx = await ctxRes.json();
  var profiles = await profRes.json();
  var sessRes = await fetch('/api/sessions/' + id);
  var session = await sessRes.json();
  if (!session || !session.id) { content.innerHTML = '<div class="warning">Session not found.</div>'; return; }
  renderSessionDetail(session, ctx, profiles);
}

function renderSessionDetail(session, ctx, profiles) {
  var content = document.getElementById('session-detail-content');
  var f = ctx.fields || {};
  var ss = session.jobContextSnapshot || {};
  function srcBadge(src) {
    if (src === 'extracted') return '<span style="background:#d4edda;color:#155724;padding:1px 6px;border-radius:3px;font-size:11px">extracted</span>';
    if (src === 'corrected') return '<span style="background:#fff3cd;color:#856404;padding:1px 6px;border-radius:3px;font-size:11px">corrected</span>';
    if (src === 'supplied') return '<span style="background:#cce5ff;color:#004085;padding:1px 6px;border-radius:3px;font-size:11px">supplied</span>';
    return '';
  }
  function fRow(label, val, src) {
    var v = val;
    if (Array.isArray(v)) v = v.length ? v.join(', ') : '<em>none</em>';
    if (v === null || v === undefined || v === '') v = '<em style="color:#6c757d">missing</em>';
    return '<tr><td style="font-weight:600;white-space:nowrap;vertical-align:top;padding-right:8px">' + label + '</td><td>' + v + '</td><td style="white-space:nowrap">' + (src ? srcBadge(src) : '') + '</td></tr>';
  }
  var pfOpts = (profiles || []).map(function(p) {
    var sel = p.id === session.selectedCareerProfileId ? ' selected' : '';
    return '<option value="' + p.id + '"' + sel + '>' + escHtml(p.name || p.id) + ' (' + p.track + ')</option>';
  }).join('');
  var selSrc = session.careerProfileSelectionSource === 'auto' ? ' (automatic)' : session.careerProfileSelectionSource === 'manual' ? ' (manual)' : '';
  content.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><h3 style="margin-bottom:6px">Context Review</h3><table style="width:100%;font-size:12px">' +
      fRow('Company', ss.companyName, (f['companyName']||{}).source||'extracted') +
      fRow('Role Title', ss.roleTitle, (f['roleTitle']||{}).source||'extracted') +
      fRow('Location', ss.location||'<em>missing</em>', (f['location']||{}).source||'extracted') +
      fRow('Remote Status', ss.remoteStatus||'<em>missing</em>', (f['remoteStatus']||{}).source||'extracted') +
      fRow('Source URL', '<a href=\"' + escHtml(session.sourceJobUrl) + '\" target=\"_blank\" rel=\"noopener\">' + escHtml(session.sourceJobUrl) + '</a>', 'extracted') +
      (session.applicationUrl ? fRow('Application URL', '<a href=\"' + escHtml(session.applicationUrl) + '\" target=\"_blank\" rel=\"noopener\">' + escHtml(session.applicationUrl) + '</a>', 'extracted') : fRow('Application URL', '<em>not attached</em>', 'extracted')) +
      fRow('Capture Time', (ss.extractionTimestamp||'').slice(0,19), 'extracted') +
      fRow('Description', ss.description||'<em>missing</em>', (f['description']||{}).source||'extracted') +
      fRow('Responsibilities', ss.responsibilities||[], (f['responsibilities']||{}).source||'extracted') +
      fRow('Required Quals', ss.requiredQualifications||[], (f['requiredQualifications']||{}).source||'extracted') +
      fRow('Required Skills', ss.requiredSkills||[], (f['requiredSkills']||{}).source||'extracted') +
      fRow('Preferred Skills', ss.preferredSkills||[], (f['preferredSkills']||{}).source||'extracted') +
      fRow('Technologies', ss.technologies||[], (f['technologies']||{}).source||'extracted') +
      fRow('Employment', ss.employmentType||'<em>missing</em>', (f['employmentType']||{}).source||'extracted') +
      fRow('Seniority', ss.seniority||'<em>missing</em>', (f['seniority']||{}).source||'extracted') +
      (ss.extractionWarnings&&ss.extractionWarnings.length ? fRow('Warnings', ss.extractionWarnings.join('; '), 'extracted') : '') +
    '</table>' +
    (ss.description ? '' : '<div class="warning" style="margin-top:8px">Job description is absent. Job-specific document tailoring may be less accurate.</div>') +
    '<div style="margin-top:12px"><a href="' + escHtml(session.sourceJobUrl) + '" target="_blank" rel="noopener" class="btn btn-secondary">Open Original Posting</a></div>' +
    '</div>' +
    '<div class="form-group"><label>Company</label><input class="form-control" id="edit-company" value="' + escHtml(((f['companyName']||{}).value!==undefined?(f['companyName']||{}).value:ss.companyName||'')) + '"></div>' +
      '<div class="form-group"><label>Role Title</label><input class="form-control" id="edit-title" value="' + escHtml(((f['roleTitle']||{}).value!==undefined?(f['roleTitle']||{}).value:ss.roleTitle||'')) + '"></div>' +
      '<div class="form-group"><label>Location</label><input class="form-control" id="edit-location" value="' + escHtml(((f['location']||{}).value!==undefined?(f['location']||{}).value:ss.location||'')) + '"></div>' +
      '<div class="form-group"><label>Required Skills (comma-separated)</label><input class="form-control" id="edit-reqskills" value="' + escHtml((Array.isArray((f['requiredSkills']||{}).value)?(f['requiredSkills']||{}).value.join(', '):(ss.requiredSkills||[]).join(', '))) + '"></div>' +
      '<div class="form-group"><label>Preferred Skills (comma-separated)</label><input class="form-control" id="edit-prefskills" value="' + escHtml((Array.isArray((f['preferredSkills']||{}).value)?(f['preferredSkills']||{}).value.join(', '):(ss.preferredSkills||[]).join(', '))) + '"></div>' +
      '<div class="form-group"><label>Notes</label><input class="form-control" id="edit-notes" value="' + escHtml((session.jobContextOverrides||{}).notes||'') + '"></div>' +
      '<button class="btn btn-primary" onclick="saveManualRecovery()" style="margin-top:8px">Save Corrections</button><hr>' +
      '<h3 style="margin-bottom:6px">Career Profile</h3><div style="font-size:11px;color:#6c757d;margin-bottom:4px">Selected: <strong>' + escHtml(session.selectedCareerProfileId||'auto') + '</strong>' + selSrc + '</div>' +
      '<select class="form-control" id="edit-career-profile">' + pfOpts + '</select>' +
      '<button class="btn btn-primary" onclick="saveCareerProfile()" style="margin-top:8px">Update Career Profile</button>' +
    '</div></div>' +
    // ── DOCUMENTS SECTION ──
    '<div id="docs-section" style="margin-top:12px;border-top:1px solid #e9ecef;padding-top:12px">' +
      '<h3 style="margin-bottom:8px">📄 Documents</h3>' +
      '<div id="docs-actions" style="margin-bottom:10px">' +
        '<button class="btn btn-primary btn-sm" id="btn-gen-resume" onclick="generateResume()">📝 Generate Resume</button> ' +
        '<button class="btn btn-primary btn-sm" id="btn-gen-cover" onclick="generateCoverLetter()">✉️ Generate Cover Letter</button> ' +
        '<button class="btn btn-secondary btn-sm" onclick="loadDocuments()">🔄 Refresh</button>' +
      '</div>' +
      '<div id="docs-list" style="font-size:12px">Loading documents...</div>' +
      '<div id="docs-revise" style="display:none;margin-top:10px;padding:8px;background:#f8f9fa;border-radius:4px">' +
        '<div style="font-weight:600;margin-bottom:4px">Revise: <span id="docs-revise-label"></span></div>' +
        '<input class="form-control" id="docs-revise-input" placeholder="Describe the change you want (e.g. Make it shorter, or Focus more on backend)" style="margin-bottom:4px;font-size:12px">' +
        '<button class="btn btn-primary btn-sm" onclick="submitRevision()">Submit Revision</button> ' +
        '<button class="btn btn-secondary btn-sm" onclick="cancelRevision()">Cancel</button> ' +
        '<span id="docs-revise-status" style="margin-left:8px;font-size:11px;color:#6c757d"></span>' +
      '</div>' +
    '</div>';
}

async function saveManualRecovery() {
  if (!currentViewSessionId) return;
  var body = {};
  var v = document.getElementById('edit-company'); if (v) body.companyName = v.value || undefined;
  v = document.getElementById('edit-title'); if (v) body.roleTitle = v.value || undefined;
  v = document.getElementById('edit-location'); if (v) body.location = v.value || undefined;
  v = document.getElementById('edit-desc'); if (v) body.description = v.value || undefined;
  v = document.getElementById('edit-reqskills'); if (v) body.requiredSkills = v.value ? v.value.split(',').map(function(s){return s.trim()}).filter(Boolean) : undefined;
  v = document.getElementById('edit-prefskills'); if (v) body.preferredSkills = v.value ? v.value.split(',').map(function(s){return s.trim()}).filter(Boolean) : undefined;
  v = document.getElementById('edit-notes'); if (v) body.notes = v.value || undefined;
  var res = await fetch('/api/sessions/' + currentViewSessionId + '/context', { method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (res.ok) { showToast('Corrections saved'); viewSession(currentViewSessionId); }
}

async function saveCareerProfile() {
  if (!currentViewSessionId) return;
  var profileId = document.getElementById('edit-career-profile').value;
  var res = await fetch('/api/sessions/' + currentViewSessionId + '/career-profile', { method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({careerProfileId:profileId,selectionSource:'manual'})});
  if (res.ok) { showToast('Career profile updated'); viewSession(currentViewSessionId); }
}
var currentReviseArtifactId = null;

async function loadDocuments() {
  if (!currentViewSessionId) return;
  var list = document.getElementById('docs-list');
  if (!list) return;
  list.innerHTML = '<span style=\"color:#6c757d\">Loading...</span>';
  var res = await fetch('/api/sessions/' + currentViewSessionId + '/documents');
  if (!res.ok) { list.innerHTML = '<span style=\"color:#e63946\">Failed to load.</span>'; return; }
  var docs = await res.json();
  renderDocumentList(docs);
}

function renderDocumentList(docs) {
  var list = document.getElementById('docs-list');
  if (!list) return;
  if (!docs || docs.length === 0) {
    list.innerHTML = '<div style=\"color:#6c757d;padding:8px 0\">No documents yet. Click Generate above.</div>';
    return;
  }
  var resumes = docs.filter(function(d){return d.documentType==='RESUME';});
  var letters = docs.filter(function(d){return d.documentType==='COVER_LETTER';});

  function statusBadge(s) {
    var c = s==='PDF_COMPILED'?'#155724':'#721c24', bg = s==='PDF_COMPILED'?'#d4edda':'#f8d7da';
    return '<span style=\"background:'+bg+';color:'+c+';padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600\">'+s+'</span>';
  }

  function docCard(ds, label) {
    if (!ds.length) return '<div style=\"margin-bottom:6px\"><strong>'+label+'</strong>: <span style=\"color:#6c757d\">none</span></div>';
    var h = '<div style=\"margin-bottom:8px\"><strong>'+label+'</strong></div>';
    for (var i=0;i<ds.length;i++) {
      var d=ds[i], latest=i===0;
      h += '<div style=\"padding:6px 8px;margin-bottom:4px;background:'+(latest?'#f0f4ff':'#fff')+';border:1px solid '+(latest?'#4361ee':'#e9ecef')+';border-radius:4px\">';
      h += '<div style=\"display:flex;justify-content:space-between;align-items:center\">';
      h += '<span><strong>v'+d.version+'</strong> '+statusBadge(d.status)+(latest&&d.status==='PDF_COMPILED'?' <span style=\"font-size:10px;color:#4361ee\">current</span>':'')+'</span>';
      h += '<span style=\"font-size:10px;color:#6c757d\">'+(d.createdAt||'').slice(0,16).replace('T',' ')+'</span></div>';
      if (d.revisionReason) h += '<div style=\"font-size:10px;color:#6c757d;margin-top:2px\"><em>'+escHtml((d.revisionReason||'').length>80?d.revisionReason.slice(0,80)+'...':d.revisionReason)+'</em></div>';
      if (d.errorMessage) h += '<div style=\"font-size:10px;color:#e63946;margin-top:2px\">'+escHtml(d.errorMessage)+'</div>';
      h += '<div style=\"margin-top:4px\">';
      if (d.pdfAvailable) h += '<button class=\"btn btn-success btn-sm\" style=\"font-size:10px;padding:2px 8px\" onclick=\"openPdf('+d.artifactId+')\">📄 Open PDF</button> ';
      h += '<button class=\"btn btn-secondary btn-sm\" style=\"font-size:10px;padding:2px 8px\" onclick=\"openTex('+d.artifactId+')\">📝 View .tex</button> ';
      if (d.status==='PDF_COMPILED') h += '<button class=\"btn btn-warning btn-sm\" style=\"font-size:10px;padding:2px 8px\" onclick=\"startRevision(\x27'+d.artifactId+'\x27,\x27v'+d.version+'\x27)\">✏️ Revise</button>';
      h += '</div></div>';

  // Trigger document loading after render
  setTimeout(function() { loadDocuments(); }, 100);
    }
    return h;
  }
  list.innerHTML = docCard(resumes,'📝 Resume') + '<hr style=\"margin:8px 0\">' + docCard(letters,'✉️ Cover Letter');
}

function closeSessionDetail() {
  document.getElementById('session-detail').style.display = 'none';
  currentViewSessionId = null;
}

window.addEventListener('DOMContentLoaded', init);



var isDocGenerating = false;

async function generateResume() {
  if (!currentViewSessionId || isDocGenerating) return;
  isDocGenerating = true;
  setGenButtons(true);
  showToast('Generating resume — this may take 30-60 seconds...');
  try {
    var res = await fetch('/api/sessions/' + currentViewSessionId + '/generate-resume', { method:'POST' });
    var data = await res.json();
    if (data.success) { showToast('Resume v'+data.artifact.version+' generated!'); loadDocuments(); }
    else {
      var msg = data.errorMessage || 'Unknown error';
      if (msg.indexOf('pdflatex') !== -1) showToast('PDF compiler not found. Install TeX Live or MiKTeX to generate PDFs.');
      else if (msg.indexOf('OpenRouter') !== -1) showToast('OpenRouter unavailable. Check your API key in .env and internet connection.');
      else showToast('Resume generation failed: ' + msg);
    }
  } catch(e) { showToast('Backend unreachable. Is Jobby running at http://127.0.0.1:3141?'); }
  isDocGenerating = false;
  setGenButtons(false);
}

async function generateCoverLetter() {
  if (!currentViewSessionId || isDocGenerating) return;
  isDocGenerating = true;
  setGenButtons(true);
  showToast('Generating cover letter...');
  try {
    var res = await fetch('/api/sessions/' + currentViewSessionId + '/generate-cover-letter', { method:'POST' });
    var data = await res.json();
    if (data.success) { showToast('Cover letter v'+data.artifact.version+' generated!'); loadDocuments(); }
    else {
      var msg = data.errorMessage || 'Unknown error';
      if (msg.indexOf('OpenRouter') !== -1) showToast('OpenRouter unavailable. Check your API key in .env and internet connection.');
      else if (msg.indexOf('No company or role') !== -1) showToast('Missing job context. Attach a job posting to this session first.');
      else showToast('Cover letter generation failed: ' + msg);
    }
  } catch(e) { showToast('Backend unreachable. Is Jobby running at http://127.0.0.1:3141?'); }
  isDocGenerating = false;
  setGenButtons(false);
}

function setGenButtons(disabled) {
  var b1 = document.getElementById('btn-gen-resume'), b2 = document.getElementById('btn-gen-cover');
  if (b1) { b1.disabled = disabled; b1.textContent = disabled ? '⏳ Generating...' : '📝 Generate Resume'; }
  if (b2) { b2.disabled = disabled; b2.textContent = disabled ? '⏳ Generating...' : '✉️ Generate Cover Letter'; }
}

async function openPdf(artifactId) {
  window.open('/api/documents/' + artifactId + '/pdf', '_blank');
}

async function openTex(artifactId) {
  window.open('/api/documents/' + artifactId + '/tex', '_blank');
}

function startRevision(artifactId, label) {
  currentReviseArtifactId = artifactId;
  document.getElementById('docs-revise').style.display = 'block';
  document.getElementById('docs-revise-label').textContent = label;
  document.getElementById('docs-revise-input').value = '';
  document.getElementById('docs-revise-status').textContent = '';
}

function cancelRevision() { currentReviseArtifactId = null; document.getElementById('docs-revise').style.display = 'none'; }

async function submitRevision() {
  if (!currentReviseArtifactId || isDocGenerating) return;
  var input = document.getElementById('docs-revise-input');
  var instructions = input.value.trim();
  if (!instructions) { showToast('Enter revision instructions first.'); return; }
  isDocGenerating = true;
  var status = document.getElementById('docs-revise-status');
  status.textContent = 'Submitting...';
  try {
    var res = await fetch('/api/documents/' + currentReviseArtifactId + '/revise', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({instructions:instructions})
    });
    var data = await res.json();
    if (data.success) { showToast('Revision v'+data.artifact.version+' created!'); cancelRevision(); loadDocuments(); }
    else {
      var msg = data.errorMessage || 'Unknown error';
      if (msg.indexOf('pdflatex') !== -1) status.textContent = 'Compiler not found. Install TeX Live or MiKTeX.';
      else if (msg.indexOf('OpenRouter') !== -1) status.textContent = 'OpenRouter unavailable. Check API key.';
      else status.textContent = 'Failed: ' + msg;
    }
  } catch(e) { status.textContent = 'Backend unreachable.'; }
  isDocGenerating = false;
}
// ═══════════════════════════════════════════════
// 8. APPLICATION TRACKER
// ═══════════════════════════════════════════════
// 8. APPLICATION TRACKER
// ═══════════════════════════════════════════════

var trackerData = [];

async function loadTracker() {
  var tbody = document.getElementById('trackerTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan=\"7\" style=\"text-align:center;padding:16px;color:#6c757d\">Loading...</td></tr>';
  var res = await fetch('/api/tracker');
  if (!res.ok) { tbody.innerHTML = '<tr><td colspan=\"7\" style=\"text-align:center;padding:16px;color:#e63946\">Failed to load.</td></tr>'; return; }
  trackerData = await res.json();
  renderTrackerTable(trackerData);
}

function filterTrackerRows() {
  var search = (document.getElementById('tracker-search')?.value || '').toLowerCase();
  var filter = document.getElementById('tracker-filter')?.value || '';
  var showArchived = document.getElementById('tracker-show-archived')?.checked || false;
  var filtered = trackerData.filter(function(e) {
    if (search && (e.company + ' ' + e.role).toLowerCase().indexOf(search) === -1) return false;
    if (filter && e.trackerStatus !== filter) return false;
    if (!showArchived && e.trackerStatus === 'ARCHIVED') return false;
    return true;
  });
  renderTrackerTable(filtered);
}
function renderTrackerTable(entries) {
  var tbody = document.getElementById('trackerTableBody');
  if (!tbody) return;
  if (!trackerData || trackerData.length === 0) {
    tbody.innerHTML = '<tr><td colspan=\"7\" style=\"text-align:center;padding:24px;color:#6c757d\"><div>No applications tracked yet</div><div style=\"font-size:11px;margin-top:4px\">Start an application from a job posting to begin.</div></td></tr>';
    return;
  }
  if (!entries || entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan=\"7\" style=\"text-align:center;padding:16px;color:#6c757d\">No applications match your search or filter.</td></tr>';
    return;
  }

  var STATI = ['DRAFT','APPLIED','INTERVIEWING','OFFER','REJECTED','WITHDRAWN','ARCHIVED'];

  tbody.innerHTML = entries.map(function(e) {
    var srcLink = e.sourceUrl ? ' <a href=\"'+escHtml(e.sourceUrl)+'\" target=\"_blank\">🔗</a>' : '';
    var appLink = e.applicationUrl ? ' <a href=\"'+escHtml(e.applicationUrl)+'\" target=\"_blank\">📝</a>' : '';

    var docs = '';
    if (e.resumePdfAvailable) docs += '<a href=\"/api/documents/'+e.resumeArtifactId+'/pdf\" target=\"_blank\" title=\"Resume\">📄</a> ';
    else docs += '<span style=\"color:#adb5bd\">📄</span> ';
    if (e.coverLetterPdfAvailable) docs += '<a href=\"/api/documents/'+e.coverLetterArtifactId+'/pdf\" target=\"_blank\" title=\"Cover\">✉️</a>';
    else docs += '<span style=\"color:#adb5bd\">✉️</span>';

    var profile = e.careerProfileName ? '<span style=\"font-size:10px;color:#6c757d\">'+escHtml(e.careerProfileName)+'</span>' : '<span style=\"color:#adb5bd\">—</span>';

    var statusSelect = '<select onchange=\"updateTrackerStatus(\x27'+e.sessionId+'\x27,this.value)\" style=\"font-size:10px;padding:2px 4px\">'+
      STATI.map(function(s){return '<option value=\"'+s+'\"'+(e.trackerStatus===s?' selected':'')+'>'+s+'</option>';}).join('')+'</select>';

    var actions = '<button class=\"btn btn-secondary btn-sm\" style=\"font-size:10px;padding:2px 4px\" onclick=\"openSessionFromTracker(\x27'+e.sessionId+'\x27)\" title=\"View session\">📋</button> ';
    if (e.trackerStatus === 'DRAFT') actions += '<button class=\"btn btn-success btn-sm\" style=\"font-size:10px;padding:2px 4px\" onclick=\"markApplied(\x27'+e.sessionId+'\x27)\" title=\"Mark Applied\">✅</button> ';
    actions += '<button class=\"btn btn-secondary btn-sm\" style=\"font-size:10px;padding:2px 4px\" onclick=\"editTrackerNotes(\x27'+e.sessionId+'\x27)\" title=\"Notes\">📝</button>';

    return '<tr>'+
      '<td style=\"font-size:11px\">'+escHtml(e.company)+srcLink+'</td>'+
      '<td style=\"font-size:11px\">'+escHtml(e.role)+appLink+'</td>'+
      '<td>'+statusSelect+'</td>'+
      '<td style=\"font-size:11px\">'+(e.dateApplied||'—')+'</td>'+
      '<td>'+profile+'</td>'+
      '<td style=\"font-size:14px\">'+docs+'</td>'+
      '<td>'+actions+'</td>'+
    '</tr>';
  }).join('');
}

function openSessionFromTracker(sessionId) {
  switchTab('sessions');
  setTimeout(function() { viewSession(sessionId); }, 300);
}

async function updateTrackerStatus(sessionId, newStatus) {
  if (newStatus === 'APPLIED') {
    if (!confirm('Mark as submitted? This records today as the date.')) { loadTracker(); return; }
    var res = await fetch('/api/tracker/' + sessionId + '/mark-applied', { method:'PUT', headers:{'Content-Type':'application/json'}, body:'{}' });
  } else {
    var res = await fetch('/api/tracker/' + sessionId + '/status', {
      method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:newStatus})
    });
  }
  if (res.ok) { showToast('Status updated'); loadTracker(); }
  else { var data = await res.json(); showToast('Error: '+(data.error||'Unknown')); loadTracker(); }
}

async function markApplied(sessionId) {
  if (!confirm('Have you submitted this application? This marks it as APPLIED with today as the date.')) return;
  var res = await fetch('/api/tracker/' + sessionId + '/mark-applied', { method:'PUT', headers:{'Content-Type':'application/json'}, body:'{}' });
  if (res.ok) { showToast('Marked as APPLIED'); loadTracker(); }
  else { var data = await res.json(); showToast('Error: '+(data.error||'Unknown')); }
}

function editTrackerNotes(sessionId) {
  var entry = trackerData.find(function(e){return e.sessionId===sessionId;});
  var currentNotes = entry ? (entry.notes||'') : '';
  var notes = prompt('Edit notes:', currentNotes);
  if (notes === null) return;
  fetch('/api/tracker/' + sessionId + '/notes', {
    method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({notes:notes})
  }).then(function(res){ return res.json(); }).then(function(data){
    if (data.trackerStatus) { showToast('Notes saved'); loadTracker(); }
    else showToast('Error: '+(data.error||'Unknown')); loadTracker();
  });
}
function exportTrackerCsv() {
  // Downloads the complete tracker as CSV (all entries, unfiltered)
  window.open('/api/tracker/export', '_blank');
}

window.addEventListener('DOMContentLoaded', init);

