# Capturas e Lighthouse

Com a aplicação em execução, gere capturas desktop (1440px) e celular (390px) para cada URL `/c/<slug>` com conteúdo completo e mínimo. O comando de auditoria recomendado é:

```sh
npx lighthouse http://localhost:3000/c/<slug> --preset=desktop --output=html --output-path=./artifacts/lighthouse-desktop.html
npx lighthouse http://localhost:3000/c/<slug> --form-factor=mobile --output=html --output-path=./artifacts/lighthouse-mobile.html
```

Meta: desempenho, acessibilidade e SEO acima de 90. As imagens devem ser anexadas ao PR após a execução no CI ou ambiente local funcional.
