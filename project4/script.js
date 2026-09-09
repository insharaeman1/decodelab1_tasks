// =====================================================
// IMMUNOSPHERE - FRONTEND + FLASK BACKEND
// =====================================================

const API_URL = "/api";
const SESSION_KEY = "immunosphere_session_v1";

let db = {
  users: [],
  children: [],
  vaccinations: []
};

let currentUser = JSON.parse(
  localStorage.getItem(SESSION_KEY) || "null"
);

let currentPage = "dashboard";


// =====================================================
// BASIC HELPERS
// =====================================================

const $ = id => document.getElementById(id);

const saveSession = user => {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(user)
  );
};

const uid = () =>
  Date.now().toString(36) +
  Math.random().toString(36).slice(2, 7);

const esc = s =>
  String(s ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );

const initials = n =>
  String(n || "U")
    .split(" ")
    .map(x => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const roleName = r => ({
  parent: "Parent / Guardian",
  vaccinator: "Field Vaccinator",
  supervisor: "Vaccination Supervisor"
}[r] || r);

const today = () =>
  new Date().toLocaleDateString(
    "en-PK",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );


// =====================================================
// CNIC HELPERS
// =====================================================

function normalizeCNIC(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatCNIC(value) {
  const d = normalizeCNIC(value).slice(0, 13);

  if (d.length <= 5)
    return d;

  if (d.length <= 12)
    return d.slice(0, 5) + "-" + d.slice(5);

  return (
    d.slice(0, 5) +
    "-" +
    d.slice(5, 12) +
    "-" +
    d.slice(12)
  );
}


// =====================================================
// API REQUEST
// =====================================================

async function apiRequest(endpoint, options = {}) {

  try {

    const response = await fetch(
      API_URL + endpoint,
      {
        ...options,

        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
      }
    );

    const data =
      await response.json().catch(() => ({}));

    if (!response.ok) {

      throw new Error(
        data.error ||
        data.message ||
        `Server error: ${response.status}`
      );

    }

    return data;

  } catch (error) {

    console.error(
      "API ERROR:",
      endpoint,
      error
    );

    throw error;
  }
}


// =====================================================
// NORMALIZE BACKEND DATA
// Flask SQLite uses snake_case.
// Frontend uses camelCase.
// =====================================================

function normalizeUser(u) {

  return {
    id: u.id,
    name: u.name || "",
    email: u.email || "",
    password: u.password || "",
    role: u.role || "",
    cnic: u.cnic || "",
    createdAt:
      u.createdAt ||
      u.created_at ||
      ""
  };

}


function normalizeChild(c) {

  return {
    id: c.id,

    name:
      c.name || "",

    dob:
      c.dob || "",

    mother:
      c.mother || "",

    parentCnic:
      c.parentCnic ||
      c.parent_cnic ||
      "",

    address:
      c.address || "",

    gender:
      c.gender || "",

    status:
      c.status || "pending",

    createdBy:
      c.createdBy ??
      c.created_by ??
      null,

    createdAt:
      c.createdAt ||
      c.created_at ||
      "",

    lastVaccine:
      c.lastVaccine ||
      c.last_vaccine ||
      "",

    lastDose:
      c.lastDose ||
      c.last_dose ||
      "",

    lastVaccinationDate:
      c.lastVaccinationDate ||
      c.last_vaccination_date ||
      "",

    updatedAt:
      c.updatedAt ||
      c.updated_at ||
      ""
  };

}


function normalizeVaccination(v) {

  return {
    id:
      v.id,

    childId:
      v.childId ??
      v.child_id,

    parentCnic:
      v.parentCnic ||
      v.parent_cnic ||
      "",

    vaccine:
      v.vaccine || "",

    dose:
      v.dose || "",

    status:
      v.status || "",

    date:
      v.date || "",

    location:
      v.location || "",

    vaccinatorId:
      v.vaccinatorId ??
      v.vaccinator_id,

    createdAt:
      v.createdAt ||
      v.created_at ||
      ""
  };

}


// =====================================================
// LOAD ALL DATA FROM DATABASE
// =====================================================

async function loadBackendData() {

  try {

    const [
      usersResponse,
      childrenResponse,
      vaccinationsResponse
    ] = await Promise.all([

      apiRequest("/users"),

      apiRequest("/children"),

      apiRequest("/vaccinations")

    ]);


    const users =
      Array.isArray(usersResponse)
        ? usersResponse
        : (
          usersResponse.users ||
          []
        );


    const children =
      Array.isArray(childrenResponse)
        ? childrenResponse
        : (
          childrenResponse.children ||
          []
        );


    const vaccinations =
      Array.isArray(vaccinationsResponse)
        ? vaccinationsResponse
        : (
          vaccinationsResponse.vaccinations ||
          []
        );


    db.users =
      users.map(normalizeUser);


    db.children =
      children.map(normalizeChild);


    db.vaccinations =
      vaccinations.map(
        normalizeVaccination
      );


    console.log(
      "DATABASE DATA LOADED:",
      db
    );

  } catch (error) {

    console.error(
      "Database loading failed:",
      error
    );

    throw error;
  }
}


// =====================================================
// AUTH TABS
// =====================================================

document
  .querySelectorAll(".auth-tab")
  .forEach(b => {

    b.onclick = () =>
      switchAuth(
        b.dataset.auth
      );

  });


document
  .querySelectorAll(".switch-auth")
  .forEach(b => {

    b.onclick = () =>
      switchAuth("signup");

  });


if ($("signupRole")) {

  $("signupRole").onchange = () => {

    $("parentCnicWrap")
      .classList
      .toggle(
        "hidden",
        $("signupRole").value !== "parent"
      );

  };

}


$("loginForm").onsubmit = login;

$("signupForm").onsubmit = signup;

$("logoutBtn").onclick = logout;


$("forgotBtn").onclick = () => {

  toast(
    "Password reset feature is not connected yet."
  );

};


// =====================================================
// SWITCH LOGIN / SIGNUP
// =====================================================

function switchAuth(mode) {

  document
    .querySelectorAll(".auth-tab")
    .forEach(x =>
      x.classList.toggle(
        "active",
        x.dataset.auth === mode
      )
    );


  $("loginForm")
    .classList
    .toggle(
      "hidden",
      mode !== "login"
    );


  $("signupForm")
    .classList
    .toggle(
      "hidden",
      mode !== "signup"
    );


  $("authTitle").innerHTML =
    mode === "login"
      ? "Welcome Back! 👋"
      : "Create Your Account";


  $("authSubtitle").textContent =
    mode === "login"
      ? "Sign in to continue to your ImmunoSphere dashboard."
      : "Choose your role and start using the immunization portal.";

}


// =====================================================
// SIGN UP
// BACKEND CONNECTED
// =====================================================

async function signup(e) {

  e.preventDefault();


  const name =
    $("signupName")
      .value
      .trim();


  const email =
    $("signupEmail")
      .value
      .trim()
      .toLowerCase();


  const pass =
    $("signupPassword").value;


  const confirm =
    $("signupConfirm").value;


  const role =
    $("signupRole").value;


  const cnicInput =
    $("signupCnic");


  const cnic =
    cnicInput
      ? formatCNIC(
        cnicInput.value.trim()
      )
      : "";


  $("signupError").textContent = "";


  // Password validation
  if (pass !== confirm) {

    $("signupError").textContent =
      "Passwords do not match.";

    return;
  }


  // Role validation
  if (!role) {

    $("signupError").textContent =
      "Please select your role.";

    return;
  }


  // Parent CNIC validation
  if (
    role === "parent" &&
    !/^\d{5}-\d{7}-\d$/.test(cnic)
  ) {

    $("signupError").textContent =
      "Enter CNIC as xxxxx-xxxxxxx-x.";

    return;
  }


  try {

    $("signupError").textContent =
      "Creating account...";


    // ==========================================
    // SEND DATA TO FLASK
    // ==========================================

    const data =
      await apiRequest(
        "/register",
        {
          method: "POST",

          body: JSON.stringify({

            name: name,

            email: email,

            password: pass,

            role: role,

            cnic:
              role === "parent"
                ? cnic
                : ""

          })
        }
      );


    console.log(
      "REGISTER RESPONSE:",
      data
    );


    const backendUser =
      data.user ||
      data;


    const user =
      normalizeUser(
        backendUser
      );


    // Add user to frontend memory
    const existingIndex =
      db.users.findIndex(
        u =>
          String(u.id) ===
          String(user.id)
      );


    if (existingIndex >= 0) {

      db.users[existingIndex] =
        user;

    } else {

      db.users.push(user);

    }


    $("signupError").textContent = "";


    // Login after registration
    loginWith(user);


    toast(
      "Account created successfully."
    );


  } catch (error) {

    console.error(
      "SIGNUP ERROR:",
      error
    );


    $("signupError").textContent =
      error.message ||
      "Registration failed.";

  }

}


// =====================================================
// LOGIN
// BACKEND CONNECTED
// =====================================================

async function login(e) {

  e.preventDefault();


  const email =
    $("loginEmail")
      .value
      .trim()
      .toLowerCase();


  const pass =
    $("loginPassword").value;


  $("loginError").textContent = "";


  try {

    $("loginError").textContent =
      "Logging in...";


    // ==========================================
    // SEND LOGIN TO FLASK
    // ==========================================

    const data =
      await apiRequest(
        "/login",
        {
          method: "POST",

          body: JSON.stringify({

            email: email,

            password: pass

          })
        }
      );


    console.log(
      "LOGIN RESPONSE:",
      data
    );


    const backendUser =
      data.user ||
      data;


    if (
      !backendUser ||
      !backendUser.id
    ) {

      throw new Error(
        "Invalid login response."
      );

    }


    const user =
      normalizeUser(
        backendUser
      );


    // ==========================================
    // LOAD LATEST DATABASE DATA
    // ==========================================

    await loadBackendData();


    // Make sure current user exists
    const freshUser =
      db.users.find(
        u =>
          String(u.id) ===
          String(user.id)
      );


    currentUser =
      freshUser || user;


    saveSession(
      currentUser
    );


    $("loginError").textContent = "";


    // ==========================================
    // OPEN APPLICATION
    // ==========================================

    $("authScreen")
      .classList
      .add("hidden");


    $("appScreen")
      .classList
      .remove("hidden");


    currentPage =
      "dashboard";


    buildNav();

    render();


    toast(
      "Login successful."
    );


  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );


    $("loginError").textContent =
      error.message ||
      "Invalid email or password.";

  }

}


// =====================================================
// LOGIN WITH USER
// =====================================================

function loginWith(user) {

  currentUser =
    normalizeUser(user);


  saveSession(
    currentUser
  );


  $("authScreen")
    .classList
    .add("hidden");


  $("appScreen")
    .classList
    .remove("hidden");


  currentPage =
    "dashboard";


  buildNav();

  render();

}


// =====================================================
// LOGOUT
// =====================================================

function logout() {

  localStorage.removeItem(
    SESSION_KEY
  );


  currentUser = null;


  $("appScreen")
    .classList
    .add("hidden");


  $("authScreen")
    .classList
    .remove("hidden");


  switchAuth("login");


  $("loginEmail").value = "";

  $("loginPassword").value = "";

}


// =====================================================
// NAVIGATION
// =====================================================

function buildNav() {

  const common = [

    [
      "dashboard",
      "🏠",
      "Dashboard"
    ],

    [
      "profile",
      "👤",
      "Profile"
    ]

  ];


  let items =
    common;


  if (
    currentUser.role ===
    "vaccinator"
  ) {

    items = [

      [
        "dashboard",
        "🏠",
        "Dashboard"
      ],

      [
        "children",
        "👶",
        "Register Child"
      ],

      [
        "vaccination",
        "💉",
        "Vaccination"
      ],

      [
        "reports",
        "📊",
        "Polio Reports"
      ],

      [
        "profile",
        "👤",
        "Profile"
      ]

    ];

  }


  if (
    currentUser.role ===
    "parent"
  ) {

    items = [

      [
        "dashboard",
        "🏠",
        "My Children"
      ],

      [
        "children",
        "👶",
        "My Children"
      ],

      [
        "vaccination",
        "💉",
        "Vaccination History"
      ],

      [
        "reminders",
        "🔔",
        "Reminders"
      ],

      [
        "profile",
        "👤",
        "Parent Profile"
      ]

    ];

  }


  if (
    currentUser.role ===
    "supervisor"
  ) {

    items = [

      [
        "dashboard",
        "🏠",
        "Dashboard"
      ],

      [
        "children",
        "👶",
        "All Children"
      ],

      [
        "vaccination",
        "💉",
        "Vaccination Data"
      ],

      [
        "reports",
        "📊",
        "Polio Reports"
      ],

      [
        "performance",
        "📈",
        "Performance"
      ],

      [
        "alerts",
        "⚠️",
        "Alerts"
      ],

      [
        "profile",
        "👤",
        "Profile"
      ]

    ];

  }


  $("nav").innerHTML =
    items
      .map(
        i =>
          `<button class="nav-item ${
            currentPage === i[0]
              ? "active"
              : ""
          }" data-page="${i[0]}">
            ${i[1]} ${i[2]}
          </button>`
      )
      .join("");


  $("nav")
    .querySelectorAll("button")
    .forEach(b => {

      b.onclick = () => {

        currentPage =
          b.dataset.page;

        render();

      };

    });

}


// =====================================================
// RENDER
// =====================================================

function render() {

  if (!currentUser)
    return;


  $("dateNow").textContent =
    today();


  $("topUser").textContent =
    currentUser.name;


  $("sidebarUser").innerHTML = `

    <div class="avatar">
      ${initials(currentUser.name)}
    </div>

    <strong>
      ${esc(currentUser.name)}
    </strong>

    <small>
      ${roleName(currentUser.role)}
    </small>

  `;


  buildNav();


  const pages = {

    dashboard:
      dashboardPage,

    children:
      childrenPage,

    vaccination:
      vaccinationPage,

    reports:
      reportsPage,

    profile:
      profilePage,

    reminders:
      remindersPage,

    performance:
      performancePage,

    alerts:
      alertsPage

  };


  $("page").innerHTML =
    (
      pages[currentPage] ||
      dashboardPage
    )();


  bindPage();

}


// =====================================================
// CHILDREN FILTER
// =====================================================

function myChildren() {

  if (
    currentUser.role ===
    "supervisor"
  ) {

    return db.children;

  }


  if (
    currentUser.role ===
    "parent"
  ) {

    return db.children.filter(
      c =>
        normalizeCNIC(
          c.parentCnic
        ) ===
        normalizeCNIC(
          currentUser.cnic
        )
    );

  }


  return db.children.filter(
    c =>
      String(
        c.createdBy
      ) ===
      String(
        currentUser.id
      )
  );

}


// =====================================================
// VACCINATION FILTER
// =====================================================

function myVaccinations() {

  const mine =
    myChildren();


  const ids =
    new Set(
      mine.map(
        c => String(c.id)
      )
    );


  if (
    currentUser.role ===
    "supervisor"
  ) {

    return db.vaccinations;

  }


  if (
    currentUser.role ===
    "parent"
  ) {

    return db.vaccinations.filter(
      v =>
        ids.has(
          String(v.childId)
        ) ||
        mine.some(
          c =>
            normalizeCNIC(
              c.parentCnic
            ) ===
            normalizeCNIC(
              v.parentCnic
            )
        )
    );

  }


  return db.vaccinations.filter(
    v =>
      ids.has(
        String(v.childId)
      ) ||
      String(
        v.vaccinatorId
      ) ===
      String(
        currentUser.id
      )
  );

}


// =====================================================
// COUNTS
// =====================================================

function counts(children) {

  const vs =
    myVaccinations();


  return {

    children:
      children.length,

    vaccinations:
      vs.length,

    pending:
      children.filter(
        c =>
          c.status ===
          "pending"
      ).length,

    missed:
      children.filter(
        c =>
          c.status ===
          "missed" ||
          c.status ===
          "refusal"
      ).length

  };

}


// =====================================================
// STAT CARD
// =====================================================

function stat(icon, num, label) {

  return `

    <div class="stat">

      <div class="stat-icon">
        ${icon}
      </div>

      <div>

        <b>${num}</b>

        <small>
          ${label}
        </small>

      </div>

    </div>

  `;

}


// =====================================================
// DASHBOARD
// =====================================================

function dashboardPage() {

  const cs =
    myChildren();


  const co =
    counts(cs);


  if (
    currentUser.role ===
    "parent"
  ) {

    return parentDashboard(
      cs,
      co
    );

  }


  if (
    currentUser.role ===
    "supervisor"
  ) {

    return supervisorDashboard(
      cs,
      co
    );

  }


  return `

    <div class="welcome">

      <div>

        <h1>
          Hello,
          ${esc(currentUser.name)}
          👋
        </h1>

        <p>
          Register children, record polio vaccinations
          and track your field progress.
        </p>

      </div>

      <div class="welcome-icon">
        💉
      </div>

    </div>


    <div class="stats">

      ${stat(
        "👶",
        co.children,
        "Registered Children"
      )}

      ${stat(
        "💉",
        co.vaccinations,
        "Vaccinations"
      )}

      ${stat(
        "⏳",
        co.pending,
        "Pending"
      )}

      ${stat(
        "⚠️",
        co.missed,
        "Missed / Refusal"
      )}

    </div>


    <div class="grid">

      <div class="card">

        <div class="card-head">

          <h3>
            Vaccination Progress
          </h3>

          <span class="badge green">
            Polio Only
          </span>

        </div>

        ${polioProgress()}

      </div>


      <div class="card">

        <div class="card-head">

          <h3>
            Recent Activity
          </h3>

        </div>

        ${activity()}

      </div>

    </div>

  `;

}


// =====================================================
// PARENT DASHBOARD
// =====================================================

function parentDashboard(cs, co) {

  return `

    <div class="welcome">

      <div>

        <h1>
          Hello,
          ${esc(currentUser.name)}
          👋
        </h1>

        <p>
          Here is the vaccination status of children
          linked with CNIC
          ${esc(currentUser.cnic)}.
        </p>

      </div>

      <div class="welcome-icon">
        👨‍👩‍👧
      </div>

    </div>


    <div class="stats">

      ${stat(
        "👶",
        cs.length,
        "My Children"
      )}

      ${stat(
        "💉",
        co.vaccinations,
        "Polio Doses"
      )}

      ${stat(
        "⏳",
        cs.filter(
          c =>
            c.status ===
            "pending"
        ).length,
        "Pending"
      )}

      ${stat(
        "🔔",
        cs.filter(
          c =>
            c.status ===
            "missed"
        ).length,
        "Missed"
      )}

    </div>


    <div class="card">

      <div class="card-head">

        <h3>
          My Children
        </h3>

        <button
          class="secondary"
          onclick="go('children')"
        >
          View All
        </button>

      </div>

      ${childCards(cs)}

    </div>

  `;

}


// =====================================================
// SUPERVISOR DASHBOARD
// =====================================================

function supervisorDashboard(cs, co) {

  const vaccs =
    db.users.filter(
      u =>
        u.role ===
        "vaccinator"
    );


  return `

    <div
      class="welcome"
      style="background:linear-gradient(135deg,#1669d8,#3c8be8)"
    >

      <div>

        <h1>
          Hello, Supervisor 👋
        </h1>

        <p>
          Monitor polio vaccination activity
          and field performance.
        </p>

      </div>

      <div class="welcome-icon">
        📊
      </div>

    </div>


    <div class="stats">

      ${stat(
        "👥",
        vaccs.length,
        "Vaccinators"
      )}

      ${stat(
        "👶",
        cs.length,
        "Total Children"
      )}

      ${stat(
        "💉",
        co.vaccinations,
        "Polio Vaccinations"
      )}

      ${stat(
        "📈",
        polioCoverage(cs) + "%",
        "Polio Coverage"
      )}

    </div>


    <div class="grid">

      <div class="card">

        <div class="card-head">

          <h3>
            Vaccinator Activity
          </h3>

        </div>

        ${vaccinatorList()}

      </div>


      <div class="card">

        <div class="card-head">

          <h3>
            Polio Coverage
          </h3>

        </div>

        ${polioProgress()}

      </div>

    </div>

  `;

}


// =====================================================
// POLIO COVERAGE
// =====================================================

function polioCoverage(cs) {

  if (!cs.length)
    return 0;


  return Math.round(
    cs.filter(
      c =>
        c.status ===
        "vaccinated"
    ).length /
    cs.length *
    100
  );

}


// =====================================================
// VACCINATOR LIST
// =====================================================

function vaccinatorList() {

  const users =
    db.users.filter(
      u =>
        u.role ===
        "vaccinator"
    );


  if (!users.length) {

    return `
      <div class="empty">
        No vaccinators registered yet.
      </div>
    `;

  }


  return users.map(u => {

    const cs =
      db.children.filter(
        c =>
          String(c.createdBy) ===
          String(u.id)
      );


    const vs =
      db.vaccinations.filter(
        v =>
          String(v.vaccinatorId) ===
          String(u.id)
      );


    const vaccinated =
      cs.filter(
        c =>
          c.status ===
          "vaccinated"
      ).length;


    const missed =
      cs.filter(
        c =>
          c.status ===
          "missed"
      ).length;


    const refusal =
      cs.filter(
        c =>
          c.status ===
          "refusal"
      ).length;


    const pending =
      cs.filter(
        c =>
          c.status ===
          "pending"
      ).length;


    const progress =
      cs.length
        ? Math.round(
          vaccinated /
          cs.length *
          100
        )
        : 0;


    return `

      <button
        class="vaccinator-item"
        onclick="openVaccinatorDetails('${u.id}')"
        style="width:100%;text-align:left;border:0;background:transparent;padding:14px 0;border-bottom:1px solid #e8eef3;cursor:pointer"
      >

        <div
          style="display:flex;align-items:center;justify-content:space-between;gap:14px"
        >

          <div
            style="display:flex;align-items:center;gap:12px;min-width:0"
          >

            <div class="avatar">
              ${initials(u.name)}
            </div>

            <div style="min-width:0">

              <b>
                ${esc(u.name)}
              </b>

              <small
                style="display:block;color:#718096;margin-top:3px"
              >
                ${cs.length} children •
                ${vs.length} vaccinations
              </small>

            </div>

          </div>


          <span class="badge green">
            ${progress}%
          </span>

        </div>


        <div
          class="progress"
          style="margin-top:10px"
        >

          <span
            style="width:${progress}%"
          ></span>

        </div>


        <div
          style="display:flex;gap:12px;flex-wrap:wrap;margin-top:7px;font-size:11px;color:#718096"
        >

          <span>
            Vaccinated: ${vaccinated}
          </span>

          <span>
            Pending: ${pending}
          </span>

          <span>
            Missed: ${missed}
          </span>

          <span>
            Refusal: ${refusal}
          </span>

        </div>

      </button>

    `;

  }).join("");

}


// =====================================================
// VACCINATOR DETAILS
// =====================================================

function openVaccinatorDetails(
  vaccinatorId
) {

  if (
    currentUser.role !==
    "supervisor"
  )
    return;


  const u =
    db.users.find(
      x =>
        String(x.id) ===
        String(vaccinatorId) &&
        x.role ===
        "vaccinator"
    );


  if (!u)
    return;


  const cs =
    db.children.filter(
      c =>
        String(c.createdBy) ===
        String(u.id)
    );


  const vs =
    db.vaccinations.filter(
      v =>
        String(v.vaccinatorId) ===
        String(u.id)
    );


  const vaccinated =
    cs.filter(
      c =>
        c.status ===
        "vaccinated"
    ).length;


  const pending =
    cs.filter(
      c =>
        c.status ===
        "pending"
    ).length;


  const missed =
    cs.filter(
      c =>
        c.status ===
        "missed"
    ).length;


  const refusal =
    cs.filter(
      c =>
        c.status ===
        "refusal"
    ).length;


  const coverage =
    cs.length
      ? Math.round(
        vaccinated /
        cs.length *
        100
      )
      : 0;


  const opv =
    vs.filter(
      v =>
        v.vaccine ===
        "OPV"
    ).length;


  const ipv =
    vs.filter(
      v =>
        v.vaccine ===
        "IPV"
    ).length;


  const inj =
    vs.filter(
      v =>
        v.vaccine ===
        "Injection"
    ).length;


  showModal(`

    <div class="modal-head">

      <div>

        <h2>
          ${esc(u.name)}
        </h2>

        <p class="muted">
          Field Vaccinator — Individual Progress
        </p>

      </div>

      <button
        class="close"
        onclick="closeModal()"
      >
        ×
      </button>

    </div>


    <div
      class="stats"
      style="grid-template-columns:repeat(4,1fr);margin-bottom:18px"
    >

      ${stat(
        "👶",
        cs.length,
        "Children"
      )}

      ${stat(
        "💉",
        vs.length,
        "Vaccinations"
      )}

      ${stat(
        "✅",
        vaccinated,
        "Vaccinated"
      )}

      ${stat(
        "📈",
        coverage + "%",
        "Progress"
      )}

    </div>


    <div class="grid">

      <div class="card">

        <div class="card-head">

          <h3>
            Polio Progress
          </h3>

          <span class="badge green">
            ${coverage}%
          </span>

        </div>


        <div class="progress-row">

          <div class="label">

            <span>
              Vaccinated
            </span>

            <b>
              ${vaccinated}/${cs.length}
            </b>

          </div>


          <div class="progress">

            <span
              style="width:${coverage}%"
            ></span>

          </div>

        </div>


        <div
          class="legend"
          style="margin-top:12px"
        >

          <span>
            ⏳ Pending ${pending}
          </span>

          <span>
            ⚠️ Missed ${missed}
          </span>

          <span>
            🚫 Refusal ${refusal}
          </span>

        </div>

      </div>


      <div class="card">

        <div class="card-head">

          <h3>
            Vaccine Breakdown
          </h3>

        </div>


        <div class="detail-grid">

          <div class="detail">
            <small>OPV</small>
            <strong>${opv}</strong>
          </div>

          <div class="detail">
            <small>IPV</small>
            <strong>${ipv}</strong>
          </div>

          <div class="detail">
            <small>Injection</small>
            <strong>${inj}</strong>
          </div>

          <div class="detail">
            <small>Total</small>
            <strong>${vs.length}</strong>
          </div>

        </div>

      </div>

    </div>


    <div
      class="card"
      style="margin-top:16px"
    >

      <div class="card-head">

        <h3>
          Only ${esc(u.name)}'s Children
        </h3>

        <span class="badge green">
          ${cs.length}
        </span>

      </div>

      ${childRows(cs)}

    </div>


    <div
      class="card"
      style="margin-top:16px"
    >

      <div class="card-head">

        <h3>
          Only ${esc(u.name)}'s Vaccinations
        </h3>

        <span class="badge green">
          ${vs.length}
        </span>

      </div>

      ${vaccinationTable(vs)}

    </div>

  `);

}


// =====================================================
// POLIO PROGRESS
// =====================================================

function polioProgress() {

  const cs =
    myChildren();


  const p =
    polioCoverage(cs);


  return `

    <div class="report-number">
      ${p}%
    </div>

    <p class="report-note">
      Children with current status Vaccinated
    </p>


    <div class="progress-row">

      <div class="label">

        <span>
          Vaccinated
        </span>

        <b>
          ${p}%
        </b>

      </div>


      <div class="progress">

        <span
          style="width:${p}%"
        ></span>

      </div>

    </div>


    <div class="legend">

      <span>

        <i
          style="background:#0b9b62"
        ></i>

        Vaccinated

      </span>


      <span>

        <i
          style="background:#ef5b4d"
        ></i>

        Missed / Refusal

      </span>

    </div>

  `;

}


// =====================================================
// ACTIVITY
// =====================================================

function activity() {

  const arr =
    myVaccinations()
      .slice(-5)
      .reverse();


  if (!arr.length) {

    return `
      <div class="empty">
        No vaccination activity yet.
      </div>
    `;

  }


  return arr.map(v => {

    const c =
      db.children.find(
        x =>
          String(x.id) ===
          String(v.childId)
      );


    return `

      <div class="activity">

        <div class="activity-icon">
          💉
        </div>


        <div>

          <b>
            ${esc(c?.name || "Child")}
            —
            ${esc(v.vaccine)}
          </b>

          <small>
            ${esc(v.status)}
            •
            ${v.date
              ? new Date(v.date)
                .toLocaleDateString()
              : "-"
            }
          </small>

        </div>

      </div>

    `;

  }).join("");

}


// =====================================================
// CHILD CARDS
// =====================================================

function childCards(cs) {

  if (!cs.length) {

    return `
      <div class="empty">
        No children found.
      </div>
    `;

  }


  return `

    <div class="child-list">

      ${cs.map(c => `

        <div class="child-card">

          <div class="child-left">

            <div class="avatar">
              ${initials(c.name)}
            </div>


            <div>

              <h4>
                ${esc(c.name)}
              </h4>

              <p>
                DOB:
                ${esc(c.dob)}
                • Mother:
                ${esc(c.mother)}
              </p>

            </div>

          </div>


          ${statusBadge(c.status)}

        </div>

      `).join("")}

    </div>

  `;

}


// =====================================================
// STATUS BADGE
// =====================================================

function statusBadge(s) {

  return `

    <span class="badge ${
      s === "vaccinated"
        ? "green"
        : s === "missed" ||
          s === "refusal"
        ? "red"
        : "orange"
    }">

      ${
        s === "vaccinated"
          ? "Vaccinated"
          : s === "refusal"
          ? "Refusal"
          : s === "missed"
          ? "Missed"
          : "Pending"
      }

    </span>

  `;

}


// =====================================================
// CHILDREN PAGE
// =====================================================

function childrenPage() {

  const cs =
    myChildren();


  const parent =
    currentUser.role ===
    "parent";


  return `

    <div class="page-head">

      <div>

        <h1>

          ${
            parent
              ? "👶 My Children"
              : "👶 " +
                (
                  currentUser.role ===
                  "supervisor"
                    ? "All Children"
                    : "Register Child"
                )
          }

        </h1>


        <p>

          ${
            parent
              ? "Only children linked to your CNIC are displayed."
              : "Manage children and their polio vaccination records."
          }

        </p>

      </div>


      ${
        currentUser.role ===
        "vaccinator"
          ? `
            <button
              class="primary"
              onclick="openChildModal()"
            >
              + Register Child
            </button>
          `
          : ""
      }

    </div>


    <div class="card">

      <div class="toolbar">

        <input
          id="childSearch"
          placeholder="Search child, mother, CNIC or address"
        >


        <select id="childFilter">

          <option value="all">
            All Status
          </option>

          <option value="vaccinated">
            Vaccinated
          </option>

          <option value="pending">
            Pending
          </option>

          <option value="missed">
            Missed
          </option>

          <option value="refusal">
            Refusal
          </option>

        </select>

      </div>


      <div class="table-wrap">

        <table class="table">

          <thead>

            <tr>

              <th>Child</th>
              <th>DOB</th>
              <th>Mother</th>
              <th>CNIC</th>
              <th>Address</th>
              <th>Status</th>
              <th></th>

            </tr>

          </thead>


          <tbody id="childrenBody">

            ${childRows(cs)}

          </tbody>

        </table>

      </div>

    </div>

  `;

}


// =====================================================
// CHILD ROWS
// =====================================================

function childRows(cs) {

  if (!cs.length) {

    return `

      <tr>

        <td colspan="7">

          <div class="empty">

            No children found.
            A new Vaccinator starts with zero children.

          </div>

        </td>

      </tr>

    `;

  }


  return cs.map(c => `

    <tr>

      <td>
        <b>
          ${esc(c.name)}
        </b>
      </td>


      <td>
        ${esc(c.dob)}
      </td>


      <td>
        ${esc(c.mother)}
      </td>


      <td>
        ${esc(c.parentCnic || "-")}
      </td>


      <td>
        ${esc(c.address)}
      </td>


      <td>
        ${statusBadge(c.status)}
      </td>


      <td>

        <button
          class="secondary"
          onclick="viewChild('${c.id}')"
        >
          View
        </button>

      </td>

    </tr>

  `).join("");

}


// =====================================================
// VACCINATION PAGE
// =====================================================

function vaccinationPage() {

  const vs =
    myVaccinations();


  if (
    currentUser.role ===
    "parent"
  ) {

    return `

      <div class="page-head">

        <div>

          <h1>
            💉 Vaccination History
          </h1>

          <p>
            Polio vaccination records for children
            linked to your CNIC.
          </p>

        </div>

      </div>


      <div class="card">

        ${vaccinationTable(vs)}

      </div>

    `;

  }


  return `

    <div class="page-head">

      <div>

        <h1>

          💉
          ${
            currentUser.role ===
            "supervisor"
              ? "Vaccination Data"
              : "Vaccination"
          }

        </h1>


        <p>
          Record OPV, IPV and Injection doses
          with actual status.
        </p>

      </div>


      ${
        currentUser.role ===
        "vaccinator"
          ? `
            <button
              class="primary"
              onclick="openVaccinationModal()"
            >
              + Add Vaccination
            </button>
          `
          : ""
      }

    </div>


    <div class="card">

      ${vaccinationTable(vs)}

    </div>

  `;

}


// =====================================================
// VACCINATION TABLE
// =====================================================

function vaccinationTable(vs) {

  if (!vs.length) {

    return `
      <div class="empty">
        No vaccination records yet.
      </div>
    `;

  }


  return `

    <div class="table-wrap">

      <table class="table">

        <thead>

          <tr>

            <th>Child</th>
            <th>Vaccine</th>
            <th>Dose</th>
            <th>Status</th>
            <th>Date</th>
            <th>Vaccinator</th>

          </tr>

        </thead>


        <tbody>

          ${vs
            .slice()
            .reverse()
            .map(v => {

              const c =
                db.children.find(
                  x =>
                    String(x.id) ===
                    String(v.childId)
                );


              const u =
                db.users.find(
                  x =>
                    String(x.id) ===
                    String(v.vaccinatorId)
                );


              return `

                <tr>

                  <td>

                    <b>
                      ${esc(
                        c?.name ||
                        "Unknown"
                      )}
                    </b>

                  </td>


                  <td>
                    ${esc(v.vaccine)}
                  </td>


                  <td>
                    ${esc(v.dose)}
                  </td>


                  <td>
                    ${statusBadge(v.status)}
                  </td>


                  <td>
                    ${
                      v.date
                        ? new Date(v.date)
                          .toLocaleDateString()
                        : "-"
                    }
                  </td>


                  <td>
                    ${esc(
                      u?.name ||
                      "-"
                    )}
                  </td>

                </tr>

              `;

            })
            .join("")}

        </tbody>

      </table>

    </div>

  `;

}


// =====================================================
// REPORTS
// =====================================================

function reportsPage() {

  const cs =
    myChildren();


  const vs =
    myVaccinations();


  const vaccinated =
    vs.filter(
      v =>
        v.status ===
        "vaccinated"
    ).length;


  const refusal =
    vs.filter(
      v =>
        v.status ===
        "refusal"
    ).length;


  const missed =
    vs.filter(
      v =>
        v.status ===
        "missed"
    ).length;


  return `

    <div class="page-head">

      <div>

        <h1>
          📊 Polio Reports
        </h1>

        <p>
          Reports are calculated from saved
          Polio vaccination data only.
        </p>

      </div>


      <button
        class="primary"
        onclick="downloadReport()"
      >
        Download Report
      </button>

    </div>


    <div class="stats">

      ${stat(
        "👶",
        cs.length,
        "Children"
      )}

      ${stat(
        "💉",
        vs.length,
        "Polio Doses"
      )}

      ${stat(
        "✅",
        vaccinated,
        "Vaccinated"
      )}

      ${stat(
        "⚠️",
        missed + refusal,
        "Missed / Refusal"
      )}

    </div>


    <div class="grid">

      <div class="card">

        <div class="card-head">

          <h3>
            Polio Status
          </h3>

        </div>


        <div class="bar">

          ${bar(
            vaccinated,
            "Vaccinated",
            "green"
          )}

          ${bar(
            refusal,
            "Refusal",
            "red"
          )}

          ${bar(
            missed,
            "Missed",
            "orange"
          )}

        </div>

      </div>


      <div class="card">

        <div class="card-head">

          <h3>
            Coverage
          </h3>

        </div>

        ${polioProgress()}

      </div>

    </div>

  `;

}


// =====================================================
// BAR
// =====================================================

function bar(n, label, cls) {

  const total =
    Math.max(
      1,
      myVaccinations().length
    );


  const h =
    Math.max(
      8,
      n / total * 140
    );


  const color =
    cls === "green"
      ? "#0b9b62"
      : cls === "red"
      ? "#ef5b4d"
      : "#f3a62f";


  return `

    <div class="bar-col">

      <div
        class="bar-fill"
        style="height:${h}px;background:${color}"
      ></div>

      <b>
        ${n}
      </b>

      <br>

      ${label}

    </div>

  `;

}


// =====================================================
// PROFILE
// =====================================================

function profilePage() {

  return `

    <div class="page-head">

      <div>

        <h1>
          👤 Profile
        </h1>

        <p>
          Your account information
        </p>

      </div>

    </div>


    <div class="card">

      <div class="profile">

        <div class="avatar">
          ${initials(
            currentUser.name
          )}
        </div>


        <div>

          <h2>
            ${esc(
              currentUser.name
            )}
          </h2>

          <p class="muted">
            ${roleName(
              currentUser.role
            )}
          </p>

        </div>

      </div>


      <div class="detail-grid">

        <div class="detail">

          <small>
            Full Name
          </small>

          <strong>
            ${esc(
              currentUser.name
            )}
          </strong>

        </div>


        <div class="detail">

          <small>
            Email
          </small>

          <strong>
            ${esc(
              currentUser.email
            )}
          </strong>

        </div>


        <div class="detail">

          <small>
            Role
          </small>

          <strong>
            ${roleName(
              currentUser.role
            )}
          </strong>

        </div>


        <div class="detail">

          <small>
            CNIC
          </small>

          <strong>
            ${esc(
              currentUser.cnic ||
              "Not applicable"
            )}
          </strong>

        </div>

      </div>

    </div>

  `;

}


// =====================================================
// REMINDERS
// =====================================================

function remindersPage() {

  const missed =
    myChildren().filter(
      c =>
        c.status ===
        "missed" ||
        c.status ===
        "pending"
    );


  return `

    <div class="page-head">

      <div>

        <h1>
          🔔 Reminders
        </h1>

        <p>
          Upcoming and missed Polio follow-ups.
        </p>

      </div>

    </div>


    <div class="card">

      ${
        missed.length

          ? missed.map(c => `

              <div class="activity">

                <div class="activity-icon">
                  🔔
                </div>


                <div>

                  <b>
                    ${esc(c.name)}
                  </b>

                  <small>

                    ${
                      c.status ===
                      "missed"

                        ? "Missed Polio follow-up"

                        : "Pending Polio vaccination"

                    }

                  </small>

                </div>


                ${statusBadge(
                  c.status
                )}

              </div>

            `).join("")

          : `
            <div class="empty">
              No reminders.
            </div>
          `
      }

    </div>

  `;

}


// =====================================================
// PERFORMANCE
// =====================================================

function performancePage() {

  const users =
    db.users.filter(
      u =>
        u.role ===
        "vaccinator"
    );


  return `

    <div class="page-head">

      <div>

        <h1>
          📈 Performance
        </h1>

        <p>
          Individual Polio progress for every vaccinator.
          Click a vaccinator to see only their data.
        </p>

      </div>

    </div>


    <div class="card">

      <table class="table">

        <thead>

          <tr>

            <th>
              Vaccinator
            </th>

            <th>
              Children
            </th>

            <th>
              Vaccinations
            </th>

            <th>
              Vaccinated
            </th>

            <th>
              Coverage
            </th>

          </tr>

        </thead>


        <tbody>

          ${
            users.map(u => {

              const cs =
                db.children.filter(
                  c =>
                    String(
                      c.createdBy
                    ) ===
                    String(u.id)
                );


              const vs =
                db.vaccinations.filter(
                  v =>
                    String(
                      v.vaccinatorId
                    ) ===
                    String(u.id)
                );


              const cov =
                cs.length
                  ? Math.round(
                    cs.filter(
                      c =>
                        c.status ===
                        "vaccinated"
                    ).length /
                    cs.length *
                    100
                  )
                  : 0;


              return `

                <tr
                  onclick="openVaccinatorDetails('${u.id}')"
                  style="cursor:pointer"
                >

                  <td>

                    <b>
                      ${esc(u.name)}
                    </b>

                  </td>


                  <td>
                    ${cs.length}
                  </td>


                  <td>
                    ${vs.length}
                  </td>


                  <td>
                    ${
                      vs.filter(
                        v =>
                          v.status ===
                          "vaccinated"
                      ).length
                    }
                  </td>


                  <td>

                    <span class="badge green">
                      ${cov}%
                    </span>

                  </td>

                </tr>

              `;

            }).join("")

            ||

            `

              <tr>

                <td colspan="5">

                  <div class="empty">

                    No vaccinators registered yet.

                  </div>

                </td>

              </tr>

            `
          }

        </tbody>

      </table>

    </div>

  `;

}


// =====================================================
// ALERTS
// =====================================================

function alertsPage() {

  const cs =
    db.children.filter(
      c =>
        c.status ===
        "missed" ||
        c.status ===
        "refusal"
    );


  return `

    <div class="page-head">

      <div>

        <h1>
          ⚠️ Alerts
        </h1>

        <p>
          Children needing Polio follow-up.
        </p>

      </div>

    </div>


    <div class="card">

      ${
        cs.length

          ? childCards(cs)

          : `
            <div class="empty">
              No active alerts.
            </div>
          `
      }

    </div>

  `;

}


// =====================================================
// PAGE BIND
// =====================================================

function bindPage() {

  const search =
    $("childSearch");


  const filter =
    $("childFilter");


  if (search) {

    search.oninput =
      () =>
        filterChildren();

  }


  if (filter) {

    filter.onchange =
      () =>
        filterChildren();

  }

}


// =====================================================
// FILTER CHILDREN
// =====================================================

function filterChildren() {

  let cs =
    myChildren();


  const q =
    (
      $("childSearch")
        .value ||
      ""
    ).toLowerCase();


  const f =
    $("childFilter").value;


  cs =
    cs.filter(
      c =>

        `${c.name}
         ${c.mother}
         ${c.parentCnic}
         ${c.address}`
          .toLowerCase()
          .includes(q)

        &&

        (
          f === "all" ||
          c.status === f
        )
    );


  $("childrenBody")
    .innerHTML =
    childRows(cs);

}


// =====================================================
// GO
// =====================================================

function go(page) {

  currentPage =
    page;

  render();

}


// =====================================================
// REGISTER CHILD MODAL
// =====================================================

function openChildModal() {

  showModal(`

    <div class="modal-head">

      <h2>
        Register New Child
      </h2>

      <button
        class="close"
        onclick="closeModal()"
      >
        ×
      </button>

    </div>


    <form
      id="childForm"
      class="form-grid"
    >

      <label>

        Child Name

        <input
          id="cName"
          required
        >

      </label>


      <label>

        Date of Birth

        <input
          id="cDob"
          type="date"
          required
        >

      </label>


      <label>

        Mother Name

        <input
          id="cMother"
          required
        >

      </label>


      <label>

        Mother / Parent CNIC

        <input
          id="cCnic"
          placeholder="xxxxx-xxxxxxx-x"
          maxlength="15"
          required
        >

      </label>


      <label>

        Address

        <input
          id="cAddress"
          required
        >

      </label>


      <label>

        Gender

        <select id="cGender">

          <option>
            Male
          </option>

          <option>
            Female
          </option>

        </select>

      </label>


      <div
        id="parentMatchInfo"
        style="grid-column:1/-1"
      ></div>


      <div
        class="form-actions"
        style="grid-column:1/-1"
      >

        <button
          type="button"
          class="secondary"
          onclick="closeModal()"
        >
          Cancel
        </button>


        <button
          class="primary"
        >
          Save Child
        </button>

      </div>

    </form>

  `);


  const cnic =
    $("cCnic");


  const info =
    $("parentMatchInfo");


  cnic.addEventListener(
    "input",
    () => {

      cnic.value =
        formatCNIC(
          cnic.value
        );


      const parent =
        db.users.find(
          u =>
            u.role ===
            "parent" &&

            normalizeCNIC(
              u.cnic
            ) ===
            normalizeCNIC(
              cnic.value
            )
        );


      info.innerHTML =
        parent

          ? `

            <div
              style="padding:10px;border-radius:10px;background:#e9f8f1;color:#087d50;font-size:12px"
            >

              <b>
                Parent matched ✓
              </b>

              <br>

              ${esc(parent.name)}
              —
              ${esc(parent.cnic)}

            </div>

          `

          : `

            <div
              style="padding:10px;border-radius:10px;background:#f8fbfd;color:#64748b;font-size:12px"
            >

              If a Parent account uses this same CNIC,
              this child will automatically appear in that
              Parent's My Children.

            </div>

          `;

    }
  );


  // ===================================================
  // SAVE CHILD TO BACKEND
  // ===================================================

  $("childForm").onsubmit =
    async e => {

      e.preventDefault();


      const parentCnic =
        formatCNIC(
          cnic.value
        );


      if (
        normalizeCNIC(
          parentCnic
        ).length !== 13
      ) {

        return toast(
          "Enter a valid 13-digit CNIC."
        );

      }


      try {

        // ==========================================
        // POST /api/children
        // ==========================================

        const data =
          await apiRequest(
            "/children",
            {
              method: "POST",

              body:
                JSON.stringify({

                  name:
                    $("cName")
                      .value
                      .trim(),

                  dob:
                    $("cDob")
                      .value,

                  mother:
                    $("cMother")
                      .value
                      .trim(),

                  parent_cnic:
                    parentCnic,

                  address:
                    $("cAddress")
                      .value
                      .trim(),

                  gender:
                    $("cGender")
                      .value,

                  status:
                    "pending",

                  created_by:
                    Number(
                      currentUser.id
                    )

                })
            }
          );


        console.log(
          "CHILD RESPONSE:",
          data
        );


        const backendChild =
          data.child ||
          data;


        const child =
          normalizeChild(
            backendChild
          );


        db.children.push(
          child
        );


        closeModal();


        // Reload database data
        await loadBackendData();


        render();


        const parent =
          db.users.find(
            u =>
              u.role ===
              "parent" &&

              normalizeCNIC(
                u.cnic
              ) ===
              normalizeCNIC(
                parentCnic
              )
          );


        toast(
          parent
            ? `Child registered and linked to ${parent.name}.`
            : "Child registered successfully."
        );


      } catch (error) {

        console.error(
          "CHILD SAVE ERROR:",
          error
        );


        toast(
          error.message ||
          "Child could not be saved."
        );

      }

    };

}


// =====================================================
// VACCINATION MODAL
// =====================================================

function openVaccinationModal() {

  const cs =
    myChildren();


  if (!cs.length) {

    return toast(
      "Register a child first."
    );

  }


  showModal(`

    <div class="modal-head">

      <h2>
        Add Polio Vaccination
      </h2>

      <button
        class="close"
        onclick="closeModal()"
      >
        ×
      </button>

    </div>


    <div
      style="padding:11px;border-radius:10px;background:#eef7ff;color:#1954a6;font-size:12px;margin-bottom:14px"
    >

      Enter the
      <b>
        same Parent/Mother CNIC
      </b>
      saved when the child was registered.

    </div>


    <form
      id="vForm"
      class="form-grid"
    >

      <label>

        Parent / Mother CNIC

        <input
          id="vCnic"
          placeholder="xxxxx-xxxxxxx-x"
          maxlength="15"
          required
        >

      </label>


      <label>

        Matching Child

        <select
          id="vChild"
          disabled
          required
        >

          <option value="">
            Enter CNIC first
          </option>

        </select>

      </label>


      <div
        id="matchedChildData"
        style="grid-column:1/-1"
      ></div>


      <label>

        Vaccine

        <select id="vaccine">

          <option>
            OPV
          </option>

          <option>
            IPV
          </option>

          <option>
            Injection
          </option>

        </select>

      </label>


      <label>

        Dose

        <select id="dose">

          <option>
            Dose 1
          </option>

          <option>
            Dose 2
          </option>

          <option>
            Dose 3
          </option>

          <option>
            Dose 4
          </option>

          <option>
            Booster
          </option>

        </select>

      </label>


      <label>

        Status

        <select id="vStatus">

          <option value="vaccinated">
            Vaccinated
          </option>

          <option value="refusal">
            Refusal
          </option>

          <option value="missed">
            Missed
          </option>

        </select>

      </label>


      <label>

        Date

        <input
          id="vDate"
          type="date"
          value="${
            new Date()
              .toISOString()
              .slice(0, 10)
          }"
          required
        >

      </label>


      <label>

        Location

        <input
          id="vLocation"
          placeholder="Field location"
        >

      </label>


      <div
        class="form-actions"
        style="grid-column:1/-1"
      >

        <button
          type="button"
          class="secondary"
          onclick="closeModal()"
        >
          Cancel
        </button>


        <button
          id="saveVaccinationBtn"
          class="primary"
          disabled
        >
          Save Vaccination
        </button>

      </div>

    </form>

  `);


  const cnic =
    $("vCnic");


  const select =
    $("vChild");


  const data =
    $("matchedChildData");


  const saveBtn =
    $("saveVaccinationBtn");


  function showChild(c) {

    if (!c)
      return;


    select.value =
      c.id;


    saveBtn.disabled =
      false;


    const parent =
      db.users.find(
        u =>
          u.role ===
          "parent" &&

          normalizeCNIC(
            u.cnic
          ) ===
          normalizeCNIC(
            c.parentCnic
          )
      );


    data.innerHTML = `

      <div
        style="padding:14px;border:1px solid #dbe8f2;border-radius:12px;background:#f8fbfd"
      >

        <div
          style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"
        >

          <b>
            ${esc(c.name)}
          </b>

          ${statusBadge(
            c.status
          )}

        </div>


        <div
          class="detail-grid"
          style="margin-top:10px"
        >

          <div class="detail">

            <small>
              DOB
            </small>

            <strong>
              ${esc(c.dob)}
            </strong>

          </div>


          <div class="detail">

            <small>
              Mother
            </small>

            <strong>
              ${esc(c.mother)}
            </strong>

          </div>


          <div class="detail">

            <small>
              CNIC
            </small>

            <strong>
              ${esc(c.parentCnic)}
            </strong>

          </div>


          <div class="detail">

            <small>
              Gender
            </small>

            <strong>
              ${esc(c.gender)}
            </strong>

          </div>


          <div class="detail">

            <small>
              Address
            </small>

            <strong>
              ${esc(c.address)}
            </strong>

          </div>


          <div class="detail">

            <small>
              Parent Account
            </small>

            <strong>
              ${
                parent
                  ? "Matched ✓"
                  : "Not registered yet"
              }
            </strong>

          </div>

        </div>

      </div>

    `;

  }


  function match() {

    const n =
      normalizeCNIC(
        cnic.value
      );


    select.disabled =
      true;


    saveBtn.disabled =
      true;


    data.innerHTML =
      "";


    if (n.length < 13) {

      select.innerHTML =
        `
          <option value="">
            Enter complete 13-digit CNIC
          </option>
        `;

      return;

    }


    const matches =
      cs.filter(
        c =>
          normalizeCNIC(
            c.parentCnic
          ) === n
      );


    if (!matches.length) {

      select.innerHTML =
        `
          <option value="">
            No child found for this CNIC
          </option>
        `;


      data.innerHTML = `

        <div
          style="padding:12px;border-radius:10px;background:#fff0ee;color:#c94a3e;font-size:12px"
        >

          <b>
            No matching child found.
          </b>

          <br>

          This CNIC is not linked to a child
          registered by this Vaccinator.

        </div>

      `;


      return;

    }


    select.disabled =
      false;


    select.innerHTML =
      matches
        .map(
          c =>
            `
              <option value="${c.id}">
                ${esc(c.name)}
                —
                ${esc(c.parentCnic)}
              </option>
            `
        )
        .join("");


    showChild(
      matches[0]
    );

  }


  cnic.addEventListener(
    "input",
    () => {

      cnic.value =
        formatCNIC(
          cnic.value
        );

      match();

    }
  );


  select.addEventListener(
    "change",
    () => {

      showChild(
        cs.find(
          c =>
            String(c.id) ===
            String(select.value)
        )
      );

    }
  );


  // ===================================================
  // SAVE VACCINATION TO BACKEND
  // ===================================================

  $("vForm").onsubmit =
    async e => {

      e.preventDefault();


      const c =
        db.children.find(
          x =>
            String(x.id) ===
            String(select.value)
        );


      if (!c) {

        return toast(
          "Enter the registered child CNIC first."
        );

      }


      if (
        normalizeCNIC(
          c.parentCnic
        ) !==
        normalizeCNIC(
          cnic.value
        )
      ) {

        return toast(
          "CNIC does not match this child."
        );

      }


      try {

        const data =
          await apiRequest(
            "/vaccinations",
            {
              method: "POST",

              body:
                JSON.stringify({

                  child_id:
                    Number(c.id),

                  parent_cnic:
                    c.parentCnic,

                  vaccine:
                    $("vaccine")
                      .value,

                  dose:
                    $("dose")
                      .value,

                  status:
                    $("vStatus")
                      .value,

                  date:
                    $("vDate")
                      .value,

                  location:
                    $("vLocation")
                      .value,

                  vaccinator_id:
                    Number(
                      currentUser.id
                    )

                })
            }
          );


        console.log(
          "VACCINATION RESPONSE:",
          data
        );


        closeModal();


        // Reload latest data
        await loadBackendData();


        render();


        toast(
          `Vaccination saved for ${c.name}.`
        );


      } catch (error) {

        console.error(
          "VACCINATION ERROR:",
          error
        );


        toast(
          error.message ||
          "Vaccination could not be saved."
        );

      }

    };

}


// =====================================================
// VIEW CHILD
// =====================================================

function viewChild(id) {

  const c =
    db.children.find(
      x =>
        String(x.id) ===
        String(id)
    );


  if (!c) {

    return toast(
      "Child not found."
    );

  }


  const vs =
    db.vaccinations.filter(
      v =>
        String(v.childId) ===
        String(id)
    );


  showModal(`

    <div class="modal-head">

      <h2>
        ${esc(c.name)}
      </h2>

      <button
        class="close"
        onclick="closeModal()"
      >
        ×
      </button>

    </div>


    <div class="profile">

      <div class="avatar">
        ${initials(c.name)}
      </div>


      <div>

        <h2>
          ${esc(c.name)}
        </h2>

        ${statusBadge(
          c.status
        )}

      </div>

    </div>


    <div class="detail-grid">

      <div class="detail">

        <small>
          DOB
        </small>

        <strong>
          ${esc(c.dob)}
        </strong>

      </div>


      <div class="detail">

        <small>
          Gender
        </small>

        <strong>
          ${esc(c.gender)}
        </strong>

      </div>


      <div class="detail">

        <small>
          Mother
        </small>

        <strong>
          ${esc(c.mother)}
        </strong>

      </div>


      <div class="detail">

        <small>
          Mother CNIC
        </small>

        <strong>
          ${esc(c.parentCnic)}
        </strong>

      </div>


      <div class="detail">

        <small>
          Address
        </small>

        <strong>
          ${esc(c.address)}
        </strong>

      </div>


      <div class="detail">

        <small>
          Vaccinations
        </small>

        <strong>
          ${vs.length}
        </strong>

      </div>

    </div>


    <h3
      style="margin:22px 0 12px"
    >
      Polio History
    </h3>


    ${vaccinationTable(vs)}

  `);

}


// =====================================================
// MODAL
// =====================================================

function showModal(content) {

  $("modalContent")
    .innerHTML =
    content;


  $("modal")
    .classList
    .remove("hidden");

}


function closeModal() {

  $("modal")
    .classList
    .add("hidden");

}


$("modal").onclick =
  e => {

    if (
      e.target.id ===
      "modal"
    ) {

      closeModal();

    }

  };


// =====================================================
// DOWNLOAD REPORT
// =====================================================

function downloadReport() {

  const cs =
    myChildren();


  const vs =
    myVaccinations();


  const text = `

IMMUNOSPHERE - POLIO REPORT

User:
${currentUser.name}

Role:
${roleName(currentUser.role)}

Date:
${today()}

Children:
${cs.length}

Polio Vaccinations:
${vs.length}

Vaccinated:
${
  vs.filter(
    v =>
      v.status ===
      "vaccinated"
  ).length
}

Refusal:
${
  vs.filter(
    v =>
      v.status ===
      "refusal"
  ).length
}

Missed:
${
  vs.filter(
    v =>
      v.status ===
      "missed"
  ).length
}

Coverage:
${polioCoverage(cs)}%

`;


  const a =
    document.createElement(
      "a"
    );


  a.href =
    URL.createObjectURL(
      new Blob(
        [text],
        {
          type:
            "text/plain"
        }
      )
    );


  a.download =
    "polio-report.txt";


  a.click();


  URL.revokeObjectURL(
    a.href
  );

}


// =====================================================
// TOAST
// =====================================================

function toast(msg) {

  const x =
    document.createElement(
      "div"
    );


  x.className =
    "toast";


  x.textContent =
    msg;


  document.body.appendChild(
    x
  );


  setTimeout(
    () =>
      x.remove(),
    2500
  );

}


// =====================================================
// SPLASH SCREEN
// =====================================================

window.addEventListener(
  "load",
  () => {

    setTimeout(
      () => {

        const splash =
          $("splashScreen");


        if (splash) {

          splash.classList.add(
            "hide"
          );


          setTimeout(
            () => {

              splash.style.display =
                "none";

            },
            500
          );

        }

      },
      5000
    );

  }
);


// =====================================================
// APPLICATION START
// =====================================================

async function startApplication() {

  try {

    // Load database from Flask
    await loadBackendData();


    // ==========================================
    // CHECK EXISTING LOGIN SESSION
    // ==========================================

    if (currentUser) {

      const freshUser =
        db.users.find(
          u =>
            String(u.id) ===
            String(currentUser.id)
        );


      if (freshUser) {

        currentUser =
          freshUser;


        saveSession(
          currentUser
        );


        $("authScreen")
          .classList
          .add("hidden");


        $("appScreen")
          .classList
          .remove("hidden");


        currentPage =
          "dashboard";


        render();

      } else {

        localStorage.removeItem(
          SESSION_KEY
        );


        currentUser =
          null;

      }

    }

  } catch (error) {

    console.error(
      "APPLICATION START ERROR:",
      error
    );


    // If backend is unavailable,
    // keep login screen visible.

    if (
      !currentUser
    ) {

      toast(
        "Backend connection failed. Make sure Flask is running."
      );

    }

  }

}


// =====================================================
// START
// =====================================================

window.addEventListener(
  "DOMContentLoaded",
  startApplication
);