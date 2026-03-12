!macro customInstall
  ; Add "Convert to PDF with MilPDF" context menu for image files
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.jpg\shell\MilPDF" "" "Convert to PDF with MilPDF"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.jpg\shell\MilPDF" "Icon" "$INSTDIR\MilPDF.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.jpg\shell\MilPDF\command" "" '"$INSTDIR\MilPDF.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.jpeg\shell\MilPDF" "" "Convert to PDF with MilPDF"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.jpeg\shell\MilPDF" "Icon" "$INSTDIR\MilPDF.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.jpeg\shell\MilPDF\command" "" '"$INSTDIR\MilPDF.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.png\shell\MilPDF" "" "Convert to PDF with MilPDF"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.png\shell\MilPDF" "Icon" "$INSTDIR\MilPDF.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.png\shell\MilPDF\command" "" '"$INSTDIR\MilPDF.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.bmp\shell\MilPDF" "" "Convert to PDF with MilPDF"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.bmp\shell\MilPDF" "Icon" "$INSTDIR\MilPDF.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.bmp\shell\MilPDF\command" "" '"$INSTDIR\MilPDF.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.gif\shell\MilPDF" "" "Convert to PDF with MilPDF"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.gif\shell\MilPDF" "Icon" "$INSTDIR\MilPDF.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.gif\shell\MilPDF\command" "" '"$INSTDIR\MilPDF.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.webp\shell\MilPDF" "" "Convert to PDF with MilPDF"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.webp\shell\MilPDF" "Icon" "$INSTDIR\MilPDF.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.webp\shell\MilPDF\command" "" '"$INSTDIR\MilPDF.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.tiff\shell\MilPDF" "" "Convert to PDF with MilPDF"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.tiff\shell\MilPDF" "Icon" "$INSTDIR\MilPDF.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.tiff\shell\MilPDF\command" "" '"$INSTDIR\MilPDF.exe" "%1"'
!macroend

!macro customUnInstall
  ; Remove context menu entries on uninstall
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.jpg\shell\MilPDF"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.jpeg\shell\MilPDF"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.png\shell\MilPDF"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.bmp\shell\MilPDF"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.gif\shell\MilPDF"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.webp\shell\MilPDF"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.tiff\shell\MilPDF"
!macroend
