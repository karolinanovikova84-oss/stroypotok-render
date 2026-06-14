import Link from "next/link";

export default function ShiftsPage() {
  return (
    <div className="authShell">
      <h1>Смены доступны в кабинете</h1>
      <Link className="button" href="/cabinet">
        Открыть кабинет
      </Link>
    </div>
  );
}
