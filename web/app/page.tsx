import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="workspaceHero workspaceHero--home">
        <div>
          <span className="eyebrow">Construction Flow</span>
          <h1>Система управления строительным процессом</h1>
          <p>
            Платформа принимает заявку клиента, превращает ее в объект, назначает прораба,
            планирует ресурсы и собирает рабочих на смены.
          </p>
        </div>
        <Link href="/auth" className="button">
          Открыть систему
        </Link>
      </section>

      <section className="processRail">
        <div className="processStep">
          <span>01</span>
          <h3>Заявка</h3>
          <p>Объект, адрес, сроки и бюджет.</p>
        </div>
        <div className="processStep">
          <span>02</span>
          <h3>Координация</h3>
          <p>Проверка заявки и выбор прораба.</p>
        </div>
        <div className="processStep">
          <span>03</span>
          <h3>Объект</h3>
          <p>Этап, ресурсы и план работ.</p>
        </div>
        <div className="processStep">
          <span>04</span>
          <h3>Рабочие</h3>
          <p>Смены, отклики и назначения.</p>
        </div>
      </section>
    </>
  );
}
