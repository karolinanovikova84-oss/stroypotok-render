"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { storeToken } from "../lib/auth-client";
import { login, register, type UserRole } from "../lib/api";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Extract<UserRole, "CLIENT" | "WORKER">>("CLIENT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result =
        mode === "login"
          ? await login({ phone, password })
          : await register({
              firstName,
              lastName: lastName || undefined,
              phone,
              email: email || undefined,
              password,
              role
            });

      storeToken(result.token);
      router.push("/cabinet");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось войти.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="authShell">
      <span className="eyebrow">Вход в систему</span>
      <h1>{mode === "login" ? "Открыть кабинет" : "Создать доступ"}</h1>

      <div className="segmented">
        <button
          className={mode === "login" ? "segmented__item segmented__item--active" : "segmented__item"}
          type="button"
          onClick={() => setMode("login")}
        >
          Вход
        </button>
        <button
          className={mode === "register" ? "segmented__item segmented__item--active" : "segmented__item"}
          type="button"
          onClick={() => setMode("register")}
        >
          Регистрация
        </button>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <>
            <div className="field">
              <label htmlFor="register-first-name">Имя</label>
              <input
                id="register-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Иван"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="register-last-name">Фамилия</label>
              <input
                id="register-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Петров"
              />
            </div>

            <div className="field">
              <label htmlFor="register-email">Email</label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="mail@example.ru"
              />
            </div>

            <div className="field">
              <label htmlFor="register-role">Тип доступа</label>
              <select
                id="register-role"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as Extract<UserRole, "CLIENT" | "WORKER">)
                }
              >
                <option value="CLIENT">Клиент</option>
                <option value="WORKER">Рабочий</option>
              </select>
            </div>
          </>
        ) : null}

        <div className="field">
          <label htmlFor="login-phone">Телефон</label>
          <input
            id="login-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+7 999 999-99-99"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Пароль</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Введите пароль"
            required
          />
        </div>

        {error ? <div className="message message--error">{error}</div> : null}

        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Подождите..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
        </button>
      </form>

      <div className="demoAccess">
        <b>Демо-доступы для защиты</b>
        <span>Администратор: +7 900 000-00-01 / demo123</span>
        <span>Координатор: +7 900 000-00-02 / demo123</span>
        <span>Прораб: +7 900 000-00-03 / demo123</span>
        <span>Рабочий: +7 900 000-00-04 / demo123</span>
        <span>Клиент: +7 900 000-00-05 / demo123</span>
      </div>
    </div>
  );
}
