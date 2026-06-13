import Link from "next/link";

export default function ShiftsPage() {
  return (
    <div className="authShell">
      <h1>Смены доступны в кабинете</h1>
      <p className="meta">Прораб публикует смены, рабочий видит доступные выходы, а клиент наблюдает ход работ по своим объектам.</p>
      <Link className="button" href="/cabinet">
        Открыть кабинет
      </Link>
    </div>
  );
}
