import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";

export const metadata: Metadata = {
  title: "Política de Privacidade • Send Inteligentte",
  description:
    "Como o Send Inteligentte coleta, usa, armazena e protege dados pessoais, conforme a LGPD (Lei 13.709/2018).",
  robots: { index: true, follow: true },
};

export default function PoliticaDePrivacidadePage() {
  return (
    <div className="main-wrapper">
      <header className="site-header">
        <Brand />
        <Link className="secondary-button compact" href="/">
          ← Voltar para a Oferta
        </Link>
      </header>

      <article className="legal-page">
        <h1>Política de Privacidade</h1>
        <p className="legal-updated">Última atualização: 7 de agosto de 2026</p>

        <div className="legal-notice">
          <strong>⚠ Documento base — pendente de revisão jurídica.</strong> Este texto foi
          redigido como ponto de partida e ainda precisa ser revisado por advogado, com
          preenchimento da razão social, do CNPJ, do endereço e do contato do encarregado de
          dados (DPO) antes de qualquer publicação.
        </div>

        <h2>1. Quem somos</h2>
        <p>
          O Send Inteligentte é uma plataforma de disparo e gestão de campanhas no WhatsApp
          operada por [RAZÃO SOCIAL], inscrita no CNPJ sob o nº [CNPJ], com sede em [ENDEREÇO
          COMPLETO]. Para os fins da Lei Geral de Proteção de Dados (Lei 13.709/2018), atuamos
          como <strong>controlador</strong> dos dados de nossos assinantes e como{" "}
          <strong>operador</strong> dos dados que nossos assinantes carregam na plataforma.
        </p>

        <h2>2. Dados que coletamos</h2>
        <ul>
          <li>
            <strong>Dados de cadastro e cobrança:</strong> nome, e-mail, telefone de WhatsApp e
            CPF ou CNPJ, informados no momento da contratação.
          </li>
          <li>
            <strong>Dados de pagamento:</strong> processados diretamente pelo gateway Asaas. Não
            armazenamos números de cartão de crédito em nossos servidores.
          </li>
          <li>
            <strong>Dados de uso:</strong> registros de acesso, endereço IP, data e hora das
            operações, conforme exigido pelo Marco Civil da Internet.
          </li>
          <li>
            <strong>Listas de contatos:</strong> dados que o assinante importa para disparar
            campanhas. Esses dados pertencem ao assinante, que é o controlador deles.
          </li>
          <li>
            <strong>Métricas de campanha:</strong> status de envio, entrega, leitura e cliques em
            links rastreáveis.
          </li>
        </ul>

        <h2>3. Para que usamos os dados</h2>
        <ul>
          <li>Executar o contrato de prestação do serviço contratado.</li>
          <li>Processar cobranças e emitir documentos fiscais.</li>
          <li>Prestar suporte técnico e comunicar mudanças relevantes no serviço.</li>
          <li>Cumprir obrigações legais e regulatórias.</li>
          <li>Prevenir fraudes e usos abusivos da plataforma.</li>
        </ul>

        <h2>4. Compartilhamento com terceiros</h2>
        <p>
          Compartilhamos dados apenas com operadores necessários à prestação do serviço:{" "}
          <strong>Meta Platforms</strong> (envio das mensagens pela WhatsApp Business Cloud API),{" "}
          <strong>Asaas</strong> (processamento de pagamentos) e provedores de infraestrutura em
          nuvem. Não vendemos dados pessoais a terceiros.
        </p>

        <h2>5. Responsabilidade do assinante sobre as listas</h2>
        <p>
          O assinante declara que possui base legal para tratar os dados dos contatos que importa
          — em regra, consentimento ou legítimo interesse devidamente documentado. O Send
          Inteligentte disponibiliza mecanismos de opt-out automático e blacklist, mas a
          licitude da origem das listas é responsabilidade exclusiva do assinante.
        </p>

        <h2>6. Retenção</h2>
        <p>
          Mantemos os dados enquanto durar a relação contratual e, após o encerramento, pelo prazo
          necessário ao cumprimento de obrigações legais (em regra, 5 anos para registros fiscais
          e 6 meses para registros de acesso, conforme o Marco Civil).
        </p>

        <h2>7. Seus direitos</h2>
        <p>
          Nos termos do art. 18 da LGPD, você pode solicitar confirmação de tratamento, acesso,
          correção, anonimização, portabilidade, eliminação e informações sobre compartilhamento
          dos seus dados. As solicitações devem ser enviadas para{" "}
          <strong>[E-MAIL DO ENCARREGADO/DPO]</strong> e serão respondidas nos prazos legais.
        </p>

        <h2>8. Segurança</h2>
        <p>
          Adotamos medidas técnicas e administrativas para proteger os dados, incluindo
          criptografia em trânsito (TLS), criptografia de tokens de acesso em repouso e controle
          de acesso por perfil. Nenhum sistema é totalmente imune a incidentes; em caso de
          violação relevante, comunicaremos os titulares e a ANPD conforme o art. 48 da LGPD.
        </p>

        <h2>9. Cookies</h2>
        <p>
          Utilizamos cookies estritamente necessários para autenticação e funcionamento da
          plataforma. [DESCREVER AQUI eventuais cookies de análise ou marketing, caso venham a ser
          adotados, com a respectiva base legal e mecanismo de consentimento.]
        </p>

        <h2>10. Links para sites externos</h2>
        <p>
          Nosso site pode conter links para sites que não operamos. Não temos controle sobre o
          conteúdo nem sobre as práticas de privacidade desses sites e não nos responsabilizamos
          por elas. Recomendamos a leitura das políticas de cada um.
        </p>

        <h2>11. Alterações</h2>
        <p>
          Podemos atualizar esta política a qualquer momento. Mudanças materiais serão comunicadas
          por e-mail ou aviso no painel com antecedência razoável.
        </p>

        <h2>12. Contato</h2>
        <p>
          Encarregado pelo tratamento de dados pessoais (DPO): <strong>[NOME]</strong> —{" "}
          <strong>[E-MAIL]</strong>.
        </p>
      </article>
    </div>
  );
}
