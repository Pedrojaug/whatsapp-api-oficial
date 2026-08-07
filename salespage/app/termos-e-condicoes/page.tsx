import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";

export const metadata: Metadata = {
  title: "Termos e Condições • Send Inteligentte",
  description:
    "Condições de uso, assinatura, cancelamento e responsabilidades da plataforma Send Inteligentte.",
  robots: { index: true, follow: true },
};

export default function TermosECondicoesPage() {
  return (
    <div className="main-wrapper">
      <header className="site-header">
        <Brand />
        <Link className="secondary-button compact" href="/">
          ← Voltar para a Oferta
        </Link>
      </header>

      <article className="legal-page">
        <h1>Termos e Condições de Uso</h1>
        <p className="legal-updated">Última atualização: 7 de agosto de 2026</p>

        <div className="legal-notice">
          <strong>⚠ Documento base — pendente de revisão jurídica.</strong> Este texto foi
          redigido como ponto de partida e ainda precisa ser revisado por advogado, com
          preenchimento da razão social, do CNPJ e do foro, além da conferência das cláusulas de
          cancelamento e reembolso frente ao Código de Defesa do Consumidor.
        </div>

        <h2>1. Objeto</h2>
        <p>
          Estes termos regulam o uso da plataforma Send Inteligentte, fornecida por [RAZÃO
          SOCIAL], CNPJ [CNPJ], que disponibiliza software para gestão de contatos e disparo de
          campanhas no WhatsApp por meio da WhatsApp Business Cloud API da Meta.
        </p>

        <h2>2. Natureza do serviço</h2>
        <p>
          O Send Inteligentte é um software independente que se integra à API oficial da Meta.
          Não somos afiliados, patrocinados ou endossados pela Meta Platforms, Inc. WhatsApp e
          Meta são marcas registradas de seus respectivos titulares. O funcionamento do serviço
          depende da disponibilidade e das políticas da Meta, que podem mudar sem aviso prévio.
        </p>

        <h2>3. Cadastro e conta</h2>
        <p>
          O assinante é responsável pela veracidade dos dados informados e pela guarda de suas
          credenciais de acesso e chaves de API. Atividades realizadas com as credenciais do
          assinante são presumidas como de sua autoria.
        </p>

        <h2>4. Assinatura, preços e renovação</h2>
        <ul>
          <li>
            Os planos são cobrados de forma antecipada, conforme a periodicidade escolhida no
            momento da contratação.
          </li>
          <li>
            A assinatura é renovada automaticamente ao fim de cada ciclo, salvo cancelamento
            solicitado antes da data de renovação.
          </li>
          <li>
            Os preços podem ser reajustados mediante comunicação com no mínimo 30 dias de
            antecedência, aplicando-se apenas aos ciclos seguintes.
          </li>
          <li>
            <strong>Importante:</strong> os valores dos planos não incluem as tarifas cobradas
            pela Meta por conversa iniciada pela empresa. Essas tarifas são cobradas diretamente
            pela Meta na conta do assinante no Meta Business Manager.
          </li>
        </ul>

        <h2>5. Cancelamento e reembolso</h2>
        <ul>
          <li>
            O cancelamento pode ser solicitado a qualquer momento, sem multa, e passa a valer ao
            fim do ciclo já pago.
          </li>
          <li>
            Nos termos do art. 49 do Código de Defesa do Consumidor, o assinante pessoa física
            pode desistir da contratação em até 7 (sete) dias corridos da assinatura, com
            devolução integral dos valores pagos.
          </li>
          <li>
            [DEFINIR: política de reembolso proporcional para cancelamentos de planos trimestral e
            anual após o prazo de arrependimento.]
          </li>
        </ul>

        <h2>6. Uso aceitável</h2>
        <p>O assinante se compromete a não utilizar a plataforma para:</p>
        <ul>
          <li>Enviar mensagens a contatos que não forneceram base legal válida para contato.</li>
          <li>Disparar conteúdo ilícito, enganoso, difamatório ou que viole direitos de terceiros.</li>
          <li>Violar as Políticas de Comércio e de Mensagens do WhatsApp Business.</li>
          <li>Tentar burlar limites de envio, mecanismos de opt-out ou controles de qualidade.</li>
        </ul>
        <p>
          O descumprimento pode acarretar suspensão imediata da conta, sem prejuízo das medidas
          legais cabíveis.
        </p>

        <h2>7. Compromisso do usuário</h2>
        <p>
          O usuário se compromete a fazer uso adequado dos conteúdos e das informações oferecidos
          pelo Send Inteligentte, em caráter enunciativo e não limitativo:
        </p>
        <ul>
          <li>
            Não se envolver em atividades ilegais ou contrárias à boa-fé e à ordem pública.
          </li>
          <li>
            Não difundir propaganda ou conteúdo de natureza racista, xenofóbica, de jogos de azar,
            pornografia ilegal, apologia ao terrorismo ou contrário aos direitos humanos.
          </li>
          <li>
            Não causar danos aos sistemas físicos e lógicos do Send Inteligentte, de seus
            fornecedores ou de terceiros, nem introduzir ou disseminar vírus ou qualquer outro
            software capaz de causar tais danos.
          </li>
        </ul>

        <h2>8. Links para sites externos</h2>
        <p>
          A plataforma pode conter links para sites que não operamos. Não temos controle sobre o
          conteúdo e as práticas desses sites e não nos responsabilizamos por suas políticas de
          privacidade. A inclusão de um link não implica endosso.
        </p>

        <h2>9. Limitação de responsabilidade</h2>
        <p>
          A plataforma opera pelo canal oficial da Meta, o que elimina o risco de bloqueio
          decorrente de automação não autorizada. Contudo, <strong>o Send Inteligentte não
          garante imunidade a restrições aplicadas pela Meta</strong>, que pode limitar, reduzir a
          qualidade ou suspender números em razão de denúncias de usuários, baixa qualidade das
          listas ou violação de suas próprias políticas. A responsabilidade pela origem e pela
          qualidade das listas é exclusiva do assinante.
        </p>
        <p>
          Não nos responsabilizamos por lucros cessantes, perda de oportunidade comercial ou danos
          indiretos decorrentes de indisponibilidade da API da Meta, de terceiros integrados ou de
          eventos de força maior.
        </p>

        <h2>10. Disponibilidade</h2>
        <p>
          Envidamos esforços para manter o serviço disponível de forma contínua, mas podem ocorrer
          interrupções para manutenção programada, atualizações ou por falhas de terceiros.
          [DEFINIR: existe SLA contratual de disponibilidade? Se sim, especificar o percentual e as
          eventuais compensações.]
        </p>

        <h2>11. Propriedade intelectual</h2>
        <p>
          O software, a marca, a identidade visual e a documentação são de titularidade exclusiva
          da contratada. A assinatura concede licença de uso não exclusiva, intransferível e
          revogável, limitada à vigência do contrato.
        </p>

        <h2>12. Dados pessoais</h2>
        <p>
          O tratamento de dados pessoais está descrito na{" "}
          <Link href="/politica-de-privacidade">Política de Privacidade</Link>, que integra estes
          termos.
        </p>

        <h2>13. Foro</h2>
        <p>
          Fica eleito o foro da comarca de [CIDADE/UF] para dirimir controvérsias, com renúncia a
          qualquer outro, por mais privilegiado que seja — ressalvado, para relações de consumo, o
          direito do consumidor de ajuizar ação em seu domicílio.
        </p>
      </article>
    </div>
  );
}
