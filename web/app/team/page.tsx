import Link from "next/link";

export default function TeamPage() {
  return (
    <div className="authShell">
      <h1>Команда управляется администратором</h1>
      <p className="meta">Создание сотрудников, клиентов и распределение ролей вынесено в админ-панель внутри кабинета.</p>
      <Link className="button" href="/cabinet">
        Открыть кабинет
      </Link>
    </div>
  );
}
