for file in $(find dashboard/src/app/api -name "route.ts" | grep -v '/public/' | grep -v '/vision/' | grep -v '/internal/'); do
  if grep -q "export async function \(POST\|PATCH\|DELETE\)" "$file"; then
    if ! grep -q "verifyCsrf" "$file"; then
      echo "Missing verifyCsrf: $file"
    fi
  fi
done
