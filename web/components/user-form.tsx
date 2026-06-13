"use client";

import { useState } from "react";

import { createUser, type User, type UserRole } from "../lib/api";

type Props = {
  token: string;
  onCreated: (user: User) => void;
};

const roles: Array<{ value: UserRole; label: string }> = [
  { value: "ADMIN", label: "Администратор" },
  { value: "MANAGER", label: "Менеджер" },
  { value: "COORDINATOR", label: "Координатор" },
  { value: "WORKER", label: "Рабочий" },
  { value: "CLIENT", label: "Клиент" }
];

export function UserForm({ token, onCreated }: Props) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    role: "WORKER" as UserRole
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const user = await createUser(
        {
          ...form,
          lastName: form.lastName || undefined,
          email: form.email || undefined
        },
        token
      );

      setMessage("Пользователь создан.");
      setForm({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        password: "",
        role: "WORKER"
      });
      onCreated(user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось создать пользователя.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="formCard">
      <h3>Новый сотрудник</h3>
      <p className="meta">Формируем ядро системы: менеджеры, координаторы, рабочие, клиенты.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="user-first-name">Имя</label>
          <input
            id="user-first-name"
            value={form.firstName}
            onChange={(event) =>
              setForm((current) => ({ ...current, firstName: event.target.value }))
            }
            placeholder="Иван"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="user-last-name">Фамилия</label>
          <input
            id="user-last-name"
            value={form.lastName}
            onChange={(event) =>
              setForm((current) => ({ ...current, lastName: event.target.value }))
            }
            placeholder="Петров"
          />
        </div>

        <div className="field">
          <label htmlFor="user-phone">Телефон</label>
          <input
            id="user-phone"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder="+7 999 999-99-99"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="user-email">Email</label>
          <input
            id="user-email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="mail@company.ru"
          />
        </div>

        <div className="field">
          <label htmlFor="user-password">Пароль</label>
          <input
            id="user-password"
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({ ...current, password: event.target.value }))
            }
            placeholder="Минимум 6 символов"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="user-role">Роль</label>
          <select
            id="user-role"
            value={form.role}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                role: event.target.value as UserRole
              }))
            }
          >
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        {message ? <div className="message message--ok">{message}</div> : null}
        {error ? <div className="message message--error">{error}</div> : null}

        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Создаем..." : "Создать пользователя"}
        </button>
      </form>
    </div>
  );
}
