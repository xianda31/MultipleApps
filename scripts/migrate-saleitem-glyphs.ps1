$table  = "SaleItem-efrr2pns5vha5evtg7bifwxv2i-NONE"
$region = "eu-west-3"
$profile = "amplify-dev"

# Mapping id -> nouvelle icone Bootstrap Icons
$updates = @(
  @{ id = "83330db4-f3b1-41ca-9ab6-74f65b18a01f"; glyph = "bi-graph-up-arrow"    }, # PERF-c couple (inactif)
  @{ id = "b1bf53a9-32cc-4b65-a2d5-016a3c78150c"; glyph = "bi-book-fill"          }, # SEF 2024
  @{ id = "9d71a89a-bad2-4219-aeee-c1b2a09c7c15"; glyph = "bi-trophy-fill"        }, # ACC accession
  @{ id = "4c2df781-d960-499a-975b-98cfcb8e58b3"; glyph = "bi-graph-up-arrow"    }, # PERF-c couple (inactif)
  @{ id = "bf8f8f72-c34d-473d-9f79-22475a902d6c"; glyph = "bi-person-check-fill"  }, # ADH-i individuel
  @{ id = "13f5da98-8ecf-4b47-a6fe-6d3212188244"; glyph = "bi-mortarboard-fill"   }, # INI initiation
  @{ id = "189d77ef-789f-491f-88ce-35147f797ec7"; glyph = "bi-credit-card-fill"   }, # LIC licence (inactif)
  @{ id = "ef304442-9a8b-4e51-96d6-edb3d2936621"; glyph = "bi-graph-up-arrow"    }, # PERF-c couple (actif)
  @{ id = "b365f17b-0686-4e53-a29d-915e9d07e8a5"; glyph = "bi-wallet2"            }, # FFB versement
  @{ id = "a896e71c-ae7f-46c2-b4f4-4fc2de04f13a"; glyph = "bi-credit-card-fill"   }, # LIC licence (inactif)
  @{ id = "06ebae4b-b3f2-4648-9c4d-2d628900f848"; glyph = "bi-people-fill"        }, # ADH-c couple
  @{ id = "dc2b3f38-874b-4069-a11d-c6893c8e17bf"; glyph = "bi-graph-up-arrow"    }, # PERF-i individuel
  @{ id = "820943a8-70b2-4207-a2c6-85de72a3f8e4"; glyph = "bi-grid-3x3-gap-fill" }, # CAR-c partagée
  @{ id = "b3300683-1577-4d15-8814-a15cf7e514dd"; glyph = "bi-grid-3x3"          }  # CAR-i individuelle
)

foreach ($item in $updates) {
  Write-Host "Updating $($item.id) -> $($item.glyph) (remove entries)..."

  $keyJson = (@{ id = @{ S = $item.id } }             | ConvertTo-Json -Compress)
  $eavJson = (@{ ':g' = @{ S = $item.glyph } }       | ConvertTo-Json -Compress)
  $eanJson = (@{ '#g' = 'glyph' }                    | ConvertTo-Json -Compress)

  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  $keyFile = [System.IO.Path]::GetTempFileName()
  $eavFile = [System.IO.Path]::GetTempFileName()
  $eanFile = [System.IO.Path]::GetTempFileName()
  [System.IO.File]::WriteAllText($keyFile, $keyJson, $utf8NoBom)
  [System.IO.File]::WriteAllText($eavFile, $eavJson, $utf8NoBom)
  [System.IO.File]::WriteAllText($eanFile, $eanJson, $utf8NoBom)

  aws dynamodb update-item `
    --profile $profile `
    --region $region `
    --table-name $table `
    --key "file://$keyFile" `
    --update-expression "SET #g = :g REMOVE entries" `
    --expression-attribute-names "file://$eanFile" `
    --expression-attribute-values "file://$eavFile" 2>&1

  Remove-Item $keyFile, $eavFile, $eanFile -Force
}

Write-Host "Done."
