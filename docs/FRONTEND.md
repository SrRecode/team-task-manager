# Frontend Implementation Guide

## 1. Stack

- React + Vite.
- Tailwind CSS.
- React Router.
- Native `fetch` or Axios.
- React state and a small authentication context initially.

Use the Tailwind setup appropriate to the installed major version; do not mix v3 and v4 configuration instructions.

## 2. Suggested client structure

```text
client/src/
├── api/
│   ├── http.js
│   ├── auth.api.js
│   ├── teams.api.js
│   └── tasks.api.js
├── components/
│   ├── layout/
│   ├── ui/
│   ├── teams/
│   └── tasks/
├── context/AuthContext.jsx
├── hooks/
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── DashboardPage.jsx
│   ├── TeamsPage.jsx
│   └── NotFoundPage.jsx
├── routes/ProtectedRoute.jsx
├── App.jsx
└── main.jsx
```

## 3. Pages and components

### Login/Register
- Accessible labels and validation messages.
- Loading state during requests.
- Generic authentication error display.
- Redirect to dashboard after successful login.
- Do not store passwords in local storage.

### Dashboard
- Sidebar or compact navigation.
- Current user information and logout.
- Team selector/list.
- Task list/table.
- Search input and team/assignee/status filters.
- Create task action.
- Empty state with a useful next action.

### Task modal
Fields:
- Title (required).
- Description (optional).
- Team (required).
- Assignee (optional; choices limited to selected team's members).
- Status.
- Due date (optional).

The same form can support create and edit modes. Disable submit while saving, show field errors, and refresh the relevant task data after success.

### Teams
- List teams the current user belongs to.
- Create team form.
- Team details and member list.
- Add an existing registered user by email.
- Show management actions only when appropriate, but always enforce permissions on the server.

## 4. API client

Centralize:
- Base URL from `VITE_API_URL`.
- `credentials: "include"` for cookie-based sessions.
- JSON content type when sending JSON.
- Safe JSON parsing.
- Consistent handling of non-2xx responses.
- No logging of passwords, cookies or secrets.

Example:

```js
const API_URL = import.meta.env.VITE_API_URL;

export async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Request failed");
  }

  return payload;
}
```

Adapt this helper to the actual API response contract and CSRF strategy. Do not assume every response has a JSON body.

## 5. Authentication state

- On app startup, request `/auth/me`.
- Treat 401 as unauthenticated, not as a fatal app crash.
- Keep user identity in memory/context; do not put session secrets in browser storage.
- Refresh auth state after login/logout.
- Protected route components improve navigation but do not secure API data.

## 6. Responsive UI and accessibility

- Test narrow mobile widths and desktop.
- Use semantic buttons and form labels.
- Ensure keyboard navigation and visible focus.
- Use sufficient color contrast.
- Give dialogs accessible names and support Escape/close behavior where appropriate.
- Do not communicate task status by color alone.
- Include loading, empty, error and success states.

## 7. Frontend acceptance checklist

- [ ] Login and registration connect to real APIs.
- [ ] Session remains valid across page refresh as designed.
- [ ] Dashboard lists only data returned by authorized API endpoints.
- [ ] Team creation and member actions work.
- [ ] Task create/edit/delete work.
- [ ] Team and assignee filters work together.
- [ ] Errors are visible and actionable.
- [ ] Layout works at mobile and desktop widths.
- [ ] Production API URL is configured correctly.
