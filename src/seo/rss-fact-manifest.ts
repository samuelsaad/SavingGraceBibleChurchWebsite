/** Safe release hashes; original public RSS prose stays on the private asset volume. */
export interface SourceRssFactAsset{path:string;sourceResponseSha256:string;key:string;sha256:string;bytes:number}
export const sourceRssFactAssets:readonly SourceRssFactAsset[]=[
  {
    "path": "/category/posts/feed/",
    "sourceResponseSha256": "3c7e3fcff64fe807cc6d61e2aa04419f0f4b72895545c19556e1c7851e02a424",
    "key": "f9eacfba6d1043a9fd731e46be5fd8210426d71606a58a4671bc0a9e1172e5d2.rssfacts",
    "sha256": "f9eacfba6d1043a9fd731e46be5fd8210426d71606a58a4671bc0a9e1172e5d2",
    "bytes": 47649
  },
  {
    "path": "/events/feed/",
    "sourceResponseSha256": "d5e94fa11eee912980f34bb8245a5584909e71316da1b5efbb35ca405a0bab99",
    "key": "b550b065f989b65fd872ab677bca0847248a984b17fbbb5b7a4a58e18a14767f.rssfacts",
    "sha256": "b550b065f989b65fd872ab677bca0847248a984b17fbbb5b7a4a58e18a14767f",
    "bytes": 25997
  },
  {
    "path": "/feed/",
    "sourceResponseSha256": "7eb2a774c50bd90361a93ef74b561c8faaf5edb152bc0d95bb9ab28d5bbe13af",
    "key": "8038933ca2724be5db143e4552646a4b02199d084702e5a7c4708daf78e78ab5.rssfacts",
    "sha256": "8038933ca2724be5db143e4552646a4b02199d084702e5a7c4708daf78e78ab5",
    "bytes": 47637
  },
  {
    "path": "/sermons/feed/",
    "sourceResponseSha256": "433fd7df00b6bd6283a6857eefeaa4966b5cea45be3f35c13eb2b3059d501037",
    "key": "857b2ae8c90de7647a10b30095e151bb2d98a0a572af26efbfae8a32a5a79516.rssfacts",
    "sha256": "857b2ae8c90de7647a10b30095e151bb2d98a0a572af26efbfae8a32a5a79516",
    "bytes": 73407
  }
];
