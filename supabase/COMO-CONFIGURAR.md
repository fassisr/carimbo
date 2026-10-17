# Ligar o servidor do Fuilá (Supabase)

1. **Banco:** no painel do Supabase, abra **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
2. **Conta automática:** em **Authentication → Sign In / Providers**, ligue **Allow anonymous sign-ins**. Assim cada jogador ganha uma conta na hora, sem cadastro.
3. **Código por e-mail:** em **Authentication → Emails → Templates**, troque o texto de **Magic Link** e de **Change Email Address** por:
   `<h2>Seu código do Fuilá</h2><p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>`
4. **Chaves:** em **Project Settings → API**, copie o **Project URL** e a chave **anon public** para `assets/config.js`.

O e-mail que vem com o Supabase manda poucos códigos por hora. Antes de lançar, ligue um SMTP próprio (por exemplo Resend) em **Authentication → Emails → SMTP Settings**.

## Cadastrar um parceiro

Em **Table Editor → partners → Insert row**, preencha nome (`n`), categoria (`cat`: cafe, bar, doce, verde ou cultura), `lat`, `lng`, `oferta` e, se quiser, `endereco`, `cidade`, `uf`, `d` (descrição) e `logo` (link da imagem). O `id` e o `segredo` são gerados sozinhos.

Para imprimir o QR do balcão, abra:
`https://fassisr.github.io/carimbo/cartaz.html?p=ID&k=SEGREDO&n=Nome&o=Oferta`

## Ver quantas visitas novas cada parceiro recebeu

No **SQL Editor**: `select * from visitas_por_parceiro order by visitas_novas desc;`
