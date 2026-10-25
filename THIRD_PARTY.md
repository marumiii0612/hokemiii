# 地図データの出典

`src/data/japan.json` と `src/data/okinawa.json` は国土地理院「地球地図日本」の都道府県境界データを使用しています。

- 原データ：国土地理院「地球地図日本」 <https://www.gsi.go.jp/kankyochiri/gm_jpn.html>
- GeoJSON変換・都道府県情報付加：dataofjapan/land <https://github.com/dataofjapan/land>
- 使用したファイル：<https://github.com/dataofjapan/land/blob/master/japan.geojson>
- 本ゲームでの加工：ポリゴンの簡略化、共通の座標変換、一部島嶼の省略。沖縄を含む日本列島全体を同じ縮尺で表示しています。ゲーム中の異変は実際の地形を示しません。

dataofjapan/land の配布時の説明では、非営利目的には出典元（地球地図日本）の明記、営利目的には出典明記と著作権者への利用報告が求められています。詳細は上記配布元のREADMEおよび原データの利用条件を参照してください。

記録写真は本ゲーム用のオリジナルイラストです。
