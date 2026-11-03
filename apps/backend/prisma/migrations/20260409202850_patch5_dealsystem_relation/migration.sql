-- AddForeignKey
ALTER TABLE "DealSystem" ADD CONSTRAINT "DealSystem_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "GlazingSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
