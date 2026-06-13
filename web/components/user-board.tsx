"use client";

import { useMemo, useState } from "react";

import type { User } from "../lib/api";
import { UserForm } from "./user-form";

type Props = {
  initialUsers: User[];
  token: string;
};

const roleLabels: Record<string, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  COORDINATOR: "Координатор",
  WORKER: "Рабочий",
  CLIENT: "Клиент"
};

export function UserBoard({ initialUsers, token }: Props) {
  const [users, setUsers] = useState(initialUsers);

  const stats = useMemo(() => {
    return {
      managers: users.filter((user) => user.role === "MANAGER").length,
      workers: users.filter((user) => user.role === "WORKER").length,
      coordinators: users.filter((user) => user.role === "COORDINATOR").length
    };
  }, [users]);

  return (
    <>
      <div className="dashboardStrip">
        <div className="metricCard">
          <span>Менеджеры</span>
          <b>{stats.managers}</b>
        </div>
        <div className="metricCard">
          <span>Координаторы</span>
          <b>{stats.coordinators}</b>
        </div>
        <div className="metricCard">
          <span>Рабочие</span>
          <b>{stats.workers}</b>
        </div>
      </div>

      <div className="split">
        <UserForm token={token} onCreated={(user) => setUsers((current) => [user, ...current])} />

        <div className="tableCard">
          <div className="sectionHead" style={{ marginTop: 0 }}>
            <div>
              <h3>Команда</h3>
              <p>Отсюда вырастут роли, авторизация и последующая запись на смены.</p>
            </div>
            <span className="status">{users.length} всего</span>
          </div>

          <div className="list">
            {users.length === 0 ? (
              <div className="item">
                <h4>Пока нет пользователей</h4>
                <div className="meta">Добавьте первого менеджера или рабочего слева.</div>
              </div>
            ) : (
              users.map((user) => (
                <div className="item" key={user.id}>
                  <div className="item__head">
                    <h4>
                      {user.firstName} {user.lastName || ""}
                    </h4>
                    <span className="status">{roleLabels[user.role] || user.role}</span>
                  </div>
                  <div className="meta">
                    <div>Телефон: {user.phone}</div>
                    <div>Email: {user.email || "не указан"}</div>
                    <div>Активность: {user.isActive ? "активен" : "отключен"}</div>
                    <div>Созданных смен: {user._count?.createdShifts ?? 0}</div>
                    <div>Назначений: {user._count?.assignments ?? 0}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
