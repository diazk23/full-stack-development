// API base URL
const API_URL = "http://localhost:3001";

// Helper: show/hide loading indicator
function setLoading(isLoading) {
  // isLoading is boolean
  if (loadingEl) {
    // if true
    loadingEl.style.display = isLoading ? "block" : "none"; // block means displayed,none means not displayed
  }
}

// // Helper: generate a short unique id
// function genId() {
//   return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// }
//
// // In-memory JSON array of Person objects
// const people = [
//  { id: genId(), name: "Alice Johnson", age: 29, email: "alice@example.com" },
//  { id: genId(), name: "Ben Thompson", age: 34, email: "ben.t@example.com" },
//  { id: genId(), name: "Carla Mendez", age: 22, email: "carla.m@example.com" },
// ];

const peopleList = document.querySelector("#peopleList");
const template = document.querySelector("#person-template");
const addForm = document.querySelector("#addPersonForm");
const searchInput = document.querySelector("#search");
const rolesSelect = document.querySelector("#rolesSelect");
const rolesLabel = document.querySelector("#rolesLabel");
const loadingEl = document.querySelector("#loading"); // retrieve the element with id "loading"

// method that will retrieve users
async function fetchPeople(searchQuery = "") {
  // defualt value of empty string
  try {
    setLoading(true);
    const url = searchQuery
      ? `${API_URL}/api/people?search=${encodeURIComponent(searchQuery)}` // create URL with search query parameter, encodeURIComponent to safely encode the search query
      : `${API_URL}/api/people`; // back tics allow for string interpolation

    const response = await fetch(url); // await for I/O bound operation
    if (!response.ok) {
      throw new Error("Failed to fetch people");
    }

    const people = await response.json(); // retrieve body of response as JSON to people variable
    return people;
  } catch (err) {
    // only executes if there was an error
    console.error(err);
    alert("Failed to load people. See console for details.");
    return []; // return empty array because it's expecting an array
  } finally {
    // always executes no matter what
    setLoading(false);
  }
}

async function renderPeople(filter = "") {
  // fetchPeople is aync, so we need to call it like an async method (using await)
  // and therefore make renderPeople also async (cant call await unless in an async function)
  const people = await fetchPeople(filter);

  peopleList.innerHTML = "";

  for (const person of people) {
    const node = template.content.cloneNode(true);
    // const personCard = node.querySelector(".card");

    node.querySelector(".person-name").textContent = person.name;
    node.querySelector(".person-age").textContent = `Age: ${person.age}`;
    node.querySelector(".person-email").textContent = person.email;

    const userRoles = await fetchUserRoles(person.id);
    const roleNames = userRoles.map((role) => role.role_name).join(", "); // allows to select multiple roles

    node.querySelector(".person-roles").textContent = `Roles: ${roleNames}`;

    node
      .querySelector(".delete")
      .addEventListener("click", () => onDelete(person.id));

    node
      .querySelector(".edit")
      .addEventListener("click", () => onEdit(person.id));

    peopleList.appendChild(node);
  }
}

addForm.addEventListener("submit", async (ev) => {
  // in-line function that is annonymous, async allows for async operations inside the function
  ev.preventDefault();

  const form = ev.currentTarget;
  const name = form.elements.name.value.trim();
  const age = Number(form.elements.age.value);
  const email = form.elements.email.value.trim();
  const selectRoles = Array.from(form.elements.roles.selectedOptions).map(
    (option) => option.value,
  );

  if (!name || !email || Number.isNaN(age)) {
    return;
  }

  try {
    setLoading(true);
    const response = await fetch(`${API_URL}/api/people`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, age, email }),
    });

    // check if got successful status code
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to add person");
    }

    // get the new person object from response
    const newPerson = await response.json();

    const roleResponse = await fetch(
      `${API_URL}/api/user_roles/${newPerson.id}/roles`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: newPerson.id,
          role_id: selectRoles,
        }),
      },
    );

    if (!roleResponse.ok) {
      const err = await roleResponse.json();
      throw new Error(err.error || "Failed to set roles for new person");
    }

    form.reset();
    await renderPeople(searchInput.value);
  } catch (error) {
    console.error(error);
    alert(error.message || "Failed to add person.");
  } finally {
    setLoading(false);
  }
});

///////////////////////////////////////////////////////////////////

async function onEdit(id) {
  try {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/people/${id}`);
    if (!res.ok) {
      throw new Error("Person not found");
    }
    const person = await res.json();

    const name = prompt("Name:", person.name);
    if (name === null) {
      return;
    }

    const ageRaw = prompt("Age:", person.age);
    if (ageRaw === null) {
      return;
    }
    const age = Number(ageRaw);

    const email = prompt("Email:", person.email);
    if (email === null) {
      return;
    }

    const userRoles = await fetchUserRoles(id);
    const currentRole = userRoles.map((role) => role.role_name).join(", ");

    const rolesInput = prompt("Role:", currentRole);

    if (rolesInput === null) {
      return;
    }

    const roleNames = rolesInput.split(",").map((r) => r.trim());

    const allRoles = await fetchRoles();
    const selectedRoles = allRoles
      .filter((role) => roleNames.includes(role.role_name))
      .map((role) => role.role_id);

    const update = await fetch(`${API_URL}/api/people/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, name, age, email }),
    });

    if (!update.ok) {
      const err = await update.json();
      throw new Error(err.error || "Failed to update person");
    }

    const roleUpdate = await fetch(`${API_URL}/api/user_roles/${id}/roles`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: id,
        role_id: selectedRoles,
      }),
    });

    if (!roleUpdate.ok) {
      const err = await roleUpdate.json();
      throw new Error(err.error || "Failed to update roles for person");
    }

    await renderPeople(searchInput.value);
  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to update person.");
  } finally {
    setLoading(false);
  }
}

async function onDelete(id) {
  if (!confirm("Delete this person?")) {
    return;
  }

  try {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/people/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete person");
    }

    await renderPeople(searchInput.value);
  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to delete person.");
  } finally {
    setLoading(false);
  }
}

// get all roles to load into to the dropdown
async function fetchRoles() {
  try {
    setLoading(true);

    const url = `${API_URL}/api/roles`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("Failed to fetch roles");
    }

    const roles = await res.json();
    return roles;
  } catch (err) {
    console.error(err);
    alert("Failed to load roles. See console for details.");
    return [];
  } finally {
    setLoading(false);
  }
}

async function renderRoles() {
  const roles = await fetchRoles();

  rolesSelect.innerHTML = "";

  for (const role of roles) {
    const option = document.createElement("option");
    option.value = role.role_id;
    option.textContent = role.role_name;
    rolesSelect.appendChild(option);
  }

  rolesLabel.style.display = "block";
}

async function fetchUserRoles(user_id) {
  setLoading(true);

  try {
    const url = `${API_URL}/api/user_roles/${user_id}/roles`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("Failed to fetch user roles");
    }

    const userRoles = await res.json();
    return userRoles;
  } catch (err) {
    console.error(err);
    alert("Failed to load user roles. See console for details.");
    return [];
  } finally {
    setLoading(false);
  }
}

searchInput.addEventListener("input", (ev) => {
  renderPeople(ev.target.value);
});

renderRoles();
renderPeople();
