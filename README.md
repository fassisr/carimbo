# Fuilá

Fuilá: colecione os lugares onde você foi. Abra o mapa, veja cafés, bares, padarias, parques e espaços culturais reais perto de você, chegue a 60 m e faça check-in para ganhar carimbos, insígnias, XP e um cupom de primeira visita.

Protótipo em um único `index.html`:

- Localização pelo GPS do navegador, com modo demo (toque no mapa para andar).
- Lugares do OpenStreetMap via Overpass API; mapa 3D com estilo próprio (MapLibre GL + OpenFreeMap, sem chave de API).
- Avaliações abrem no Google Maps; ofertas são de exemplo nesta versão.
- Progresso salvo no próprio aparelho (localStorage).

Publicado com GitHub Pages a partir da branch `main`.

## App Android

A cada push na `main`, o GitHub Actions gera um APK de teste e publica numa release:
https://github.com/fassisr/carimbo/releases/latest/download/fuila.apk

O app Android é o mesmo `index.html` empacotado com Capacitor (`android/`), usando o GPS nativo.

## Créditos

Personagens 3D: corpos, cabelos, capuz e animações da [Quaternius](https://quaternius.com) (Universal Base Characters, Universal Animation Library e Modular Character Outfits), licença CC0. Roupas, bonés, chapéus, mochila e capa são gerados pelo próprio app. Mapa: © OpenStreetMap, OpenFreeMap, OpenMapTiles.
